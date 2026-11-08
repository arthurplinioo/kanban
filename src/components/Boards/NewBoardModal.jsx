import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';

export default function NewBoardModal({ isOpen, onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (isOpen) setTitle(''); }, [isOpen]);

  const submit = async () => {
    if (!title.trim() || busy) return;
    setBusy(true);
    const id = await onCreate(title.trim());
    setBusy(false);
    if (id) onClose(id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => onClose(null)}
      title="Novo quadro compartilhado"
      footer={(
        <>
          <button className="btn btn-secondary" onClick={() => onClose(null)}>Cancelar</button>
          <button className="btn btn-primary" onClick={submit} disabled={!title.trim() || busy}>{busy ? 'Criando...' : 'Criar e convidar'}</button>
        </>
      )}
    >
      <div className="form-group">
        <label className="form-label" htmlFor="new-board-title">Nome do quadro</label>
        <input
          id="new-board-title"
          className="form-input"
          value={title}
          maxLength={120}
          autoFocus
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="Ex.: Casa, Viagem, Projeto da equipe"
        />
        <p className="task-sync-hint">
          Depois de criar, voce convida as pessoas pelo e-mail da conta Google delas. So quem foi convidado consegue abrir.
        </p>
      </div>
    </Modal>
  );
}
