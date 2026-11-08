import React, { useEffect, useRef, useState } from 'react';
import { APP_NAME } from '../../config/variant';

const STATUS_LABEL = {
  synced: 'Sincronizado',
  syncing: 'Sincronizando...',
  offline: 'Offline - salvo no aparelho',
  error: 'Erro ao sincronizar',
  idle: 'Entrar para sincronizar',
  local: 'Somente neste aparelho',
};

function AccountMenu({ cloud }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);

  if (!cloud.enabled) return null;

  if (!cloud.user) {
    return (
      <button className="btn btn-primary btn-sm header-signin" onClick={cloud.signIn} disabled={!cloud.authReady}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
        Entrar
      </button>
    );
  }

  const initial = (cloud.user.displayName || cloud.user.email || '?').slice(0, 1).toUpperCase();
  return (
    <div className="dropdown" ref={ref}>
      <button className={`header-avatar sync-${cloud.status}`} onClick={() => setOpen(v => !v)} title={STATUS_LABEL[cloud.status]}>
        {cloud.user.photoURL
          ? <img src={cloud.user.photoURL} alt="" referrerPolicy="no-referrer" />
          : <span>{initial}</span>}
        <i className="header-avatar-dot" />
      </button>
      {open && (
        <div className="dropdown-menu account-menu">
          <div className="account-menu-head">
            <strong>{cloud.user.displayName || 'Conta Google'}</strong>
            <span>{cloud.user.email}</span>
            <span className={`account-status sync-${cloud.status}`}>{STATUS_LABEL[cloud.status]}</span>
          </div>
          <div className="dropdown-divider" />
          <button className="dropdown-item danger" onClick={cloud.signOut}>Sair desta conta</button>
        </div>
      )}
    </div>
  );
}

export default function Header({
  activeView,
  onViewChange,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  isGoogleConnected,
  onGoogleClick,
  showCalendarButton,
  cloud,
  boardSwitcher,
  onRemindersClick,
  remindersEnabled,
}) {
  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          <span className="header-logo-text">{APP_NAME}</span>
        </div>
        {boardSwitcher}
        <nav className="header-nav">
          <button className={`header-nav-btn ${activeView === 'board' ? 'active' : ''}`} onClick={() => onViewChange('board')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
            <span>Quadro</span>
          </button>
          <button className={`header-nav-btn ${activeView === 'calendar' ? 'active' : ''}`} onClick={() => onViewChange('calendar')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span>Calendário</span>
          </button>
        </nav>
      </div>

      <div className="header-right">
        <div className="search-container">
          <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input className="search-input" type="search" placeholder="Buscar tarefas..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
        </div>

        <button className={`header-icon-btn ${remindersEnabled ? 'google-connected' : ''}`} onClick={onRemindersClick}
          title={remindersEnabled ? 'Lembretes ativos' : 'Ativar lembretes'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        </button>

        {showCalendarButton && (
          <button className={`header-icon-btn ${isGoogleConnected ? 'google-connected' : ''}`} onClick={onGoogleClick}
            title={isGoogleConnected ? 'Google Agenda conectado' : 'Conectar Google Agenda'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              {isGoogleConnected && <polyline points="9 16 11 18 15 14" />}
            </svg>
          </button>
        )}

        <button className="header-icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>

        <AccountMenu cloud={cloud} />
      </div>
    </header>
  );
}
