import React from 'react';

export default function MobileNavBar({ activeView, onViewChange }) {
  return (
    <nav className="mobile-navbar">
      <button className={`mobile-navbar-btn ${activeView === 'board' ? 'active' : ''}`} onClick={() => onViewChange('board')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        <span>Quadro</span>
      </button>
      <button className={`mobile-navbar-btn ${activeView === 'calendar' ? 'active' : ''}`} onClick={() => onViewChange('calendar')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span>Agenda</span>
      </button>
    </nav>
  );
}
