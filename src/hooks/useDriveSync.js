import { useEffect, useRef, useState } from 'react';
import { driveSync } from '../services/driveSync';

const POLL_INTERVAL_MS = 20 * 1000;
const PUSH_DEBOUNCE_MS = 1500;

/**
 * Sincroniza o quadro completo com o Google Drive (pasta appData do próprio
 * usuário), para que PC e celular fiquem com o mesmo quadro. Diferente do
 * Google Agenda (que só troca eventos com data), isso replica colunas,
 * tarefas, subtarefas e tudo mais.
 *
 * Estratégia simples de "última escrita vence": ao conectar, baixa o que
 * estiver no Drive (ou cria o arquivo lá, se for a primeira vez); a cada
 * mudança local, envia (debounced); a cada poucos segundos, verifica se
 * outro dispositivo mudou o arquivo remoto e, se sim, baixa.
 */
export function useDriveSync(board, setBoard, isConnected, showToast) {
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const initializedRef = useRef(false);
  const lastModifiedRef = useRef(null);
  const lastSerializedRef = useRef(null);
  const pushTimerRef = useRef(null);

  useEffect(() => {
    if (!isConnected) {
      initializedRef.current = false;
      lastModifiedRef.current = null;
      lastSerializedRef.current = null;
      setStatus('idle');
      return;
    }
    if (initializedRef.current) return;
    initializedRef.current = true;

    (async () => {
      setStatus('syncing');
      try {
        const remote = await driveSync.download();
        if (remote) {
          setBoard(remote.board);
          lastModifiedRef.current = remote.modifiedTime;
          lastSerializedRef.current = JSON.stringify(remote.board);
          showToast?.('Quadro sincronizado com o Google Drive');
        } else {
          const result = await driveSync.upload(board);
          lastModifiedRef.current = result.modifiedTime;
          lastSerializedRef.current = JSON.stringify(board);
        }
        setStatus('synced');
      } catch (error) {
        console.error('Erro na sincronizacao inicial com o Drive:', error);
        setStatus('error');
      }
    })();
  }, [isConnected, board, setBoard, showToast]);

  useEffect(() => {
    if (!isConnected || !initializedRef.current) return undefined;
    const serialized = JSON.stringify(board);
    if (serialized === lastSerializedRef.current) return undefined;

    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      try {
        setStatus('syncing');
        const result = await driveSync.upload(board);
        lastModifiedRef.current = result.modifiedTime;
        lastSerializedRef.current = serialized;
        setStatus('synced');
      } catch (error) {
        console.error('Erro ao enviar mudancas para o Drive:', error);
        setStatus('error');
      }
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimerRef.current);
  }, [board, isConnected]);

  useEffect(() => {
    if (!isConnected) return undefined;
    const interval = setInterval(async () => {
      try {
        const file = await driveSync.findFile();
        if (!file || file.modifiedTime === lastModifiedRef.current) return;
        const remote = await driveSync.download();
        if (!remote) return;
        setBoard(remote.board);
        lastModifiedRef.current = remote.modifiedTime;
        lastSerializedRef.current = JSON.stringify(remote.board);
        showToast?.('Quadro atualizado a partir de outro dispositivo');
      } catch (error) {
        console.error('Erro ao verificar mudancas no Drive:', error);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected, setBoard, showToast]);

  return status;
}
