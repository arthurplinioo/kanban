import { useEffect, useRef, useState } from 'react';
import { driveSync } from '../services/driveSync';
import { storage } from '../services/storage';
import { boardToDoc, docToBoard, rebase, isPristineDefaultBoard, same } from '../utils/boardModel';

const POLL_INTERVAL_MS = 20 * 1000;
const PUSH_DEBOUNCE_MS = 1500;
const SYNC_ID = 'drive-personal';

/**
 * Sincroniza o "Meu Quadro" com o Google Drive (pasta oculta do app) quando o
 * Firebase ainda nao esta configurado.
 *
 * Nunca substitui o quadro local inteiro: guarda a ultima versao sincronizada
 * (base) e, quando o Drive tem algo novo, reaplica as mudancas locais por cima
 * (mesmo merge por tarefa usado no Firestore). Antes, abrir o app com uma copia
 * antiga no Drive apagava o que tinha sido editado e ainda nao enviado.
 */
export function useDriveSync(board, setBoard, isConnected, showToast) {
  const [status, setStatus] = useState('idle'); // idle | syncing | synced | error
  const initializedRef = useRef(false);
  const lastModifiedRef = useRef(null);
  // Edicoes de sessoes anteriores nao enviadas ja estao marcadas em `dirty`.
  const lastAppliedRef = useRef(JSON.stringify(board));
  const pushTimerRef = useRef(null);
  const boardRef = useRef(board);
  boardRef.current = board;
  const syncRef = useRef(storage.loadSyncState(SYNC_ID) || { base: null, dirty: false });

  const persist = () => storage.saveSyncState(SYNC_ID, syncRef.current);

  const apply = (nextBoard) => {
    lastAppliedRef.current = JSON.stringify(nextBoard);
    boardRef.current = nextBoard;
    setBoard(nextBoard);
  };

  // Mescla o que esta no Drive com o que esta no aparelho e devolve o
  // resultado (ja aplicado na tela).
  const mergeRemote = (remoteBoard) => {
    const remoteDoc = boardToDoc(remoteBoard);
    const localDoc = boardToDoc(boardRef.current);
    const { base, dirty } = syncRef.current;
    let mergedDoc;
    if (base) {
      mergedDoc = dirty || !same(base, localDoc) ? rebase(base, localDoc, remoteDoc) : remoteDoc;
    } else {
      // Primeira sincronizacao neste aparelho: uniao, sem apagar nada.
      mergedDoc = isPristineDefaultBoard(boardRef.current) ? remoteDoc : rebase(null, localDoc, remoteDoc);
    }
    const merged = docToBoard(mergedDoc);
    apply(merged);
    return { merged, changedRemote: !same(mergedDoc, remoteDoc), remoteDoc };
  };

  const upload = async (boardToSend) => {
    const result = await driveSync.upload(boardToSend);
    lastModifiedRef.current = result.modifiedTime;
    syncRef.current = { base: boardToDoc(boardToSend), dirty: false };
    persist();
  };

  useEffect(() => {
    if (!isConnected) {
      initializedRef.current = false;
      lastModifiedRef.current = null;
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
          lastModifiedRef.current = remote.modifiedTime;
          const { merged, changedRemote, remoteDoc } = mergeRemote(remote.board);
          if (changedRemote) {
            await upload(merged);
          } else {
            syncRef.current = { base: remoteDoc, dirty: false };
            persist();
          }
        } else {
          await upload(boardRef.current);
        }
        setStatus('synced');
      } catch (error) {
        console.error('Erro na sincronizacao inicial com o Drive:', error);
        setStatus('error');
      }
    })();
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toda edicao local fica marcada como pendente (sobrevive a fechar o app)
  // e e enviada logo em seguida se houver conexao com o Google.
  useEffect(() => {
    if (JSON.stringify(board) === lastAppliedRef.current) return undefined;
    if (!syncRef.current.dirty) {
      syncRef.current = { ...syncRef.current, dirty: true };
      persist();
    }
    if (!isConnected || !initializedRef.current) return undefined;

    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(async () => {
      try {
        setStatus('syncing');
        const file = await driveSync.findFile();
        // Outro aparelho mexeu desde a ultima sincronizacao: mescla antes de enviar.
        if (file && file.modifiedTime !== lastModifiedRef.current) {
          const remote = await driveSync.download();
          if (remote) {
            lastModifiedRef.current = remote.modifiedTime;
            mergeRemote(remote.board);
          }
        }
        await upload(boardRef.current);
        setStatus('synced');
      } catch (error) {
        console.error('Erro ao enviar mudancas para o Drive:', error);
        setStatus('error');
      }
    }, PUSH_DEBOUNCE_MS);

    return () => clearTimeout(pushTimerRef.current);
  }, [board, isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isConnected) return undefined;
    const interval = setInterval(async () => {
      try {
        const file = await driveSync.findFile();
        if (!file || file.modifiedTime === lastModifiedRef.current) return;
        const remote = await driveSync.download();
        if (!remote) return;
        lastModifiedRef.current = remote.modifiedTime;
        const { merged, changedRemote, remoteDoc } = mergeRemote(remote.board);
        if (changedRemote) await upload(merged);
        else {
          syncRef.current = { base: remoteDoc, dirty: false };
          persist();
        }
        showToast?.('Quadro atualizado a partir de outro dispositivo');
      } catch (error) {
        console.error('Erro ao verificar mudancas no Drive:', error);
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isConnected]); // eslint-disable-line react-hooks/exhaustive-deps

  return status;
}
