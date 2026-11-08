import React, { useEffect, useRef, useState } from 'react';

export default function BoardSwitcher({ boards, activeBoardId, currentTitle, onSelect, onCreate, onShare, canShare }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  return (
    <div className="board-switcher" ref={ref}>
      <button className="board-switcher-btn" onClick={() => setOpen(v => !v)} aria-haspopup="menu" aria-expanded={open}>
        <span className="board-switcher-title">{currentTitle}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {canShare && (
        <button className="board-share-btn" onClick={onShare} title="Compartilhar quadro">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          <span>Pessoas</span>
        </button>
      )}
      {open && (
        <div className="dropdown-menu board-switcher-menu" role="menu">
          {boards.map(board => (
            <button
              key={board.id}
              role="menuitem"
              className={`dropdown-item ${board.id === activeBoardId ? 'active' : ''}`}
              onClick={() => { onSelect(board.id); setOpen(false); }}
            >
              {board.type === 'personal' ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              )}
              <span className="board-switcher-item-title">{board.title}</span>
              {board.type === 'shared' && <span className="board-switcher-count">{board.memberEmails?.length || 1}</span>}
            </button>
          ))}
          <div className="dropdown-divider" />
          <button className="dropdown-item accent" role="menuitem" onClick={() => { onCreate(); setOpen(false); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Novo quadro compartilhado
          </button>
        </div>
      )}
    </div>
  );
}
