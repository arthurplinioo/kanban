import React from 'react';

export default function Header({
  activeView,
  onViewChange,
  searchQuery,
  onSearchChange,
  theme,
  onToggleTheme,
  isGoogleConnected,
  onGoogleClick,
  cloudSyncStatus,
  isCloudSyncEnabled,
  onCloudClick,
}) {
  const cloudState = cloudSyncStatus?.state || 'idle';

  return (
    <header className="header">
      <div className="header-left">
        <div className="header-logo">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          TaskFlow
        </div>
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
          <input className="search-input" type="text" placeholder="Buscar tarefas..." value={searchQuery} onChange={e => onSearchChange(e.target.value)} />
        </div>

        <button className={`header-icon-btn ${isGoogleConnected ? 'google-connected' : ''}`} onClick={onGoogleClick}
          title={isGoogleConnected ? 'Google Agenda conectado' : 'Conectar Google Agenda'}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            {isGoogleConnected && <polyline points="9 16 11 18 15 14" />}
          </svg>
        </button>

        <button
          className={`header-icon-btn cloud-sync-btn ${isCloudSyncEnabled ? 'cloud-enabled' : ''} ${cloudState}`}
          onClick={onCloudClick}
          title={cloudSyncStatus?.message || 'Configurar Cloud Sync'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17.5 19H7a5 5 0 0 1-.8-9.94A7 7 0 0 1 19.5 11.5 3.75 3.75 0 0 1 17.5 19z" />
            {cloudState === 'synced' && <polyline points="8 13 11 16 16 10" />}
            {cloudState === 'conflict' && <line x1="12" y1="9" x2="12" y2="14" />}
            {cloudState === 'conflict' && <line x1="12" y1="17" x2="12.01" y2="17" />}
          </svg>
          {cloudState === 'syncing' && <span className="header-status-dot syncing" />}
          {cloudState === 'error' && <span className="header-status-dot error" />}
          {cloudState === 'conflict' && <span className="header-status-dot warning" />}
        </button>

        <button className="header-icon-btn" onClick={onToggleTheme} title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}>
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
    </header>
  );
}
