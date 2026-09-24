import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';

const DRIVE_STATUS_LABEL = {
  idle: null,
  syncing: 'Sincronizando quadro com o Google Drive...',
  synced: 'Quadro sincronizado com o Google Drive (PC e celular ficam iguais).',
  error: 'Falha ao sincronizar o quadro com o Google Drive. Tentando novamente...',
};

export default function GoogleConfigModal({ isOpen, onClose, clientId, onUpdateClientId, isConnected, onSignIn, onSignOut, driveSyncStatus }) {
  const [id, setId] = useState(clientId || '');

  useEffect(() => {
    setId(clientId || '');
  }, [clientId]);

  const handleSave = () => {
    onUpdateClientId(id.trim());
    if (!isConnected && id.trim()) setTimeout(() => onSignIn(), 500);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Google Agenda"
      footer={(
        <>
          {isConnected && <button className="btn btn-danger" onClick={() => { onSignOut(); onClose(); }}>Desconectar</button>}
          <button className="btn btn-primary" onClick={handleSave}>Salvar</button>
        </>
      )}
    >
      <div className="google-sync-panel" style={{ background: 'transparent', padding: 0 }}>
        <div className="google-sync-status">
          <div className={`google-sync-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="google-sync-text">{isConnected ? 'Conectado ao Google Agenda' : 'Nao conectado'}</span>
        </div>

        {!isConnected && (
          <>
            <div className="form-group">
              <label className="form-label">Client ID do Google</label>
              <input className="form-input" value={id} onChange={event => setId(event.target.value)} placeholder="Seu Client ID OAuth2..." />
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', marginTop: '8px', lineHeight: 1.6 }}>
                Crie um projeto no <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary-400)', textDecoration: 'underline' }}>Google Cloud Console</a>, ative a Calendar API <strong>e a Google Drive API</strong>, e use credenciais OAuth2 do tipo web (adicione o endereço do app publicado como origem autorizada).
              </p>
            </div>

            {id.trim() && (
              <button
                className="btn btn-google"
                onClick={() => {
                  onUpdateClientId(id.trim());
                  setTimeout(onSignIn, 500);
                }}
                style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Conectar com Google
              </button>
            )}
          </>
        )}

        {isConnected && (
          <>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--accent-400)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              Seus eventos estao sendo sincronizados automaticamente quando a tarefa esta com sincronizacao ativa.
            </p>
            {DRIVE_STATUS_LABEL[driveSyncStatus] && (
              <p style={{ fontSize: 'var(--text-xs)', color: driveSyncStatus === 'error' ? 'var(--danger-400, #f87171)' : 'var(--text-tertiary)', marginTop: '4px' }}>
                {DRIVE_STATUS_LABEL[driveSyncStatus]}
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
