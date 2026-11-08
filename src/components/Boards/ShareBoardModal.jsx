import React, { useEffect, useState } from 'react';
import Modal from '../common/Modal';
import { buildInviteLink } from '../../hooks/useCloudBoards';
import { normalizeEmail } from '../../services/boardsRepo';
import { APP_NAME } from '../../config/variant';

function inviteText(boardTitle, link) {
  return `Oi! Te convidei para o quadro "${boardTitle}" no ${APP_NAME}.\n\n`
    + `1) Abra: ${link}\n`
    + '2) Entre com a sua conta Google deste e-mail.\n\n'
    + 'Pelo iPhone: abra no Safari e use Compartilhar > Adicionar a Tela de Inicio.';
}

export default function ShareBoardModal({ isOpen, onClose, meta, boardTitle, myEmail, onInvite, onRemove, onDelete }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [lastInvited, setLastInvited] = useState('');
  const [copied, setCopied] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (isOpen) { setEmail(''); setError(''); setLastInvited(''); setCopied(false); setConfirmDelete(false); }
  }, [isOpen]);

  if (!meta) return null;
  const link = buildInviteLink(meta.id);
  const text = inviteText(boardTitle, link);
  const me = normalizeEmail(myEmail);

  const submit = async () => {
    setError('');
    setBusy(true);
    try {
      const invited = await onInvite(email);
      setLastInvited(invited);
      setEmail('');
    } catch (err) {
      setError(err?.message || 'Nao foi possivel convidar');
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Nao foi possivel copiar. Selecione o link e copie manualmente.');
    }
  };

  const shareNative = async () => {
    try {
      await navigator.share({ title: boardTitle, text, url: link });
    } catch {
      // usuario cancelou o compartilhamento
    }
  };

  const mailto = (to) => `mailto:${encodeURIComponent(to || '')}?subject=${encodeURIComponent(`Convite: quadro "${boardTitle}"`)}&body=${encodeURIComponent(text)}`;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Pessoas neste quadro">
      {meta.isOwner ? (
        <div className="form-group">
          <label className="form-label" htmlFor="invite-email">Convidar por e-mail (conta Google)</label>
          <div className="share-invite-row">
            <input
              id="invite-email"
              className="form-input"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') submit(); }}
              placeholder="nome@gmail.com"
            />
            <button className="btn btn-primary" onClick={submit} disabled={!email.trim() || busy}>{busy ? '...' : 'Convidar'}</button>
          </div>
          {error && <p className="share-error">{error}</p>}
          {lastInvited && (
            <div className="share-success">
              <strong>{lastInvited}</strong> ja tem acesso. Avise a pessoa:
              <div className="share-actions">
                <a className="btn btn-secondary btn-sm" href={mailto(lastInvited)}>Enviar e-mail</a>
                <a className="btn btn-secondary btn-sm" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>
                {typeof navigator.share === 'function' && <button className="btn btn-secondary btn-sm" onClick={shareNative}>Outros</button>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="task-sync-hint" style={{ marginBottom: 16 }}>
          Quadro de <strong>{meta.ownerEmail}</strong>. Somente o dono pode convidar pessoas.
        </p>
      )}

      <div className="form-group">
        <label className="form-label">Link do quadro</label>
        <div className="share-invite-row">
          <input className="form-input" readOnly value={link} onFocus={e => e.target.select()} />
          <button className="btn btn-secondary" onClick={copy}>{copied ? 'Copiado!' : 'Copiar'}</button>
        </div>
        <p className="task-sync-hint">
          Privado: o link so abre o quadro para quem esta na lista abaixo e entrou com a conta Google desse e-mail.
        </p>
      </div>

      <div className="form-group">
        <label className="form-label">Com acesso ({meta.memberEmails.length})</label>
        <ul className="share-member-list">
          {meta.memberEmails.map(member => (
            <li key={member} className="share-member">
              <span className="share-member-avatar">{member.slice(0, 1).toUpperCase()}</span>
              <span className="share-member-email">{member}</span>
              {member === normalizeEmail(meta.ownerEmail) ? (
                <span className="share-member-role">Dono</span>
              ) : (meta.isOwner || member === me) && (
                <button className="btn btn-danger btn-sm" onClick={() => onRemove(member)}>
                  {member === me ? 'Sair' : 'Remover'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>

      {meta.isOwner && (
        <div className="share-danger-zone">
          {confirmDelete ? (
            <>
              <p>Excluir "{boardTitle}" para todos? Isso nao pode ser desfeito.</p>
              <div className="share-actions">
                <button className="btn btn-secondary btn-sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
                <button className="btn btn-danger btn-sm" onClick={() => { onDelete(); onClose(); }}>Excluir de vez</button>
              </div>
            </>
          ) : (
            <button className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>Excluir quadro</button>
          )}
        </div>
      )}
    </Modal>
  );
}
