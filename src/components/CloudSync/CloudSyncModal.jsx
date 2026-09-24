import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { DEFAULT_SYNC_FILE } from '../../services/cloudSync';

export default function CloudSyncModal({ isOpen, onClose, config, status, onSave, onSyncNow }) {
  const [enabled, setEnabled] = useState(false);
  const [token, setToken] = useState('');
  const [gistId, setGistId] = useState('');
  const [fileName, setFileName] = useState(DEFAULT_SYNC_FILE);

  useEffect(() => {
    setEnabled(!!config?.enabled);
    setToken(config?.token || '');
    setGistId(config?.gistId || '');
    setFileName(config?.fileName || DEFAULT_SYNC_FILE);
  }, [config, isOpen]);

  const handleSave = async () => {
    await onSave?.(getFormConfig());
    onClose();
  };

  const getFormConfig = () => ({
    enabled,
    token: token.trim(),
    gistId: gistId.trim(),
    fileName: fileName.trim() || DEFAULT_SYNC_FILE,
  });

  const handleSync = async (mode) => {
    const next = await onSave?.(getFormConfig(), false);
    await onSyncNow?.(mode, next);
  };

  const lastSyncText = config?.lastSyncedAt
    ? new Date(config.lastSyncedAt).toLocaleString()
    : 'Ainda nao sincronizado';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Cloud Sync"
      footer={(
        <>
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={enabled && !token.trim()}>
            Salvar
          </button>
        </>
      )}
    >
      <div className="cloud-sync-panel">
        <div className="google-sync-status">
          <div className={`google-sync-dot ${status?.state === 'synced' ? 'connected' : 'disconnected'}`} />
          <span className="google-sync-text">{status?.message || 'Cloud desligado'}</span>
        </div>

        <label className="task-sync-label cloud-sync-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={event => setEnabled(event.target.checked)}
            style={{ width: 16, height: 16, accentColor: 'var(--primary-500)' }}
          />
          Ativar sincronizacao entre PC e iPhone
        </label>

        {enabled && (
          <>
            <div className="form-group">
              <label className="form-label">Token do GitHub com permissao Gists</label>
              <input
                className="form-input"
                type="password"
                value={token}
                onChange={event => setToken(event.target.value)}
                placeholder="github_pat_..."
              />
              <p className="task-sync-hint">
                O app cria ou atualiza um Gist privado com o JSON do quadro. Use o mesmo token e Gist no iPhone para manter os dois lados sincronizados.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label">Gist ID</label>
              <input
                className="form-input"
                value={gistId}
                onChange={event => setGistId(event.target.value)}
                placeholder="Deixe vazio para criar automaticamente"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Arquivo no Gist</label>
              <input
                className="form-input"
                value={fileName}
                onChange={event => setFileName(event.target.value)}
                placeholder={DEFAULT_SYNC_FILE}
              />
            </div>

            <div className="cloud-sync-actions">
              <button className="btn btn-secondary" onClick={() => handleSync('pull')} disabled={!token.trim() || !gistId.trim()}>
                Baixar da nuvem
              </button>
              <button className="btn btn-secondary" onClick={() => handleSync('push')} disabled={!token.trim()}>
                Enviar agora
              </button>
            </div>

            <div className={`cloud-sync-note ${status?.state === 'conflict' ? 'warning' : ''}`}>
              <strong>Ultimo sync:</strong> {lastSyncText}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
