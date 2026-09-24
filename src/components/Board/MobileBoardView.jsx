import React, { useEffect, useRef, useState } from 'react';
import TaskCard from './TaskCard';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#14b8a6'];

// Kanban para celular: sem drag-and-drop entre categorias (dificil de usar
// junto com scroll de toque). Em vez disso, uma categoria por vez com abas
// para trocar, e mover tarefa de categoria acontece pelo seletor "Categoria"
// dentro do card (TaskDetailModal), que ja existia no app.
export default function MobileBoardView({
  columns, onAddTask, onUpdateColumn, onDeleteColumn, onAddColumn,
  onTaskClick, onToggleComplete, onToggleSubtask, onAddSubtask,
}) {
  const [activeColumnId, setActiveColumnId] = useState(columns[0]?.id || '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const menuRef = useRef(null);
  const tabRefs = useRef({});

  useEffect(() => {
    if (!columns.some(c => c.id === activeColumnId)) {
      setActiveColumnId(columns[0]?.id || '');
    }
  }, [columns, activeColumnId]);

  useEffect(() => {
    tabRefs.current[activeColumnId]?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeColumnId]);

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false);
        setShowColors(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const activeIndex = columns.findIndex(c => c.id === activeColumnId);
  const activeColumn = columns[activeIndex] || null;

  const goToOffset = (offset) => {
    const nextIndex = activeIndex + offset;
    if (nextIndex >= 0 && nextIndex < columns.length) {
      setActiveColumnId(columns[nextIndex].id);
    }
  };

  const handleCreateTask = () => {
    const trimmed = newTaskTitle.trim();
    if (!trimmed || !activeColumn) return;
    onAddTask(activeColumn.id, { title: trimmed });
    setNewTaskTitle('');
  };

  const handleSaveTitle = () => {
    if (editTitle.trim() && activeColumn) onUpdateColumn(activeColumn.id, { title: editTitle.trim() });
    setIsEditingTitle(false);
  };

  if (!activeColumn) {
    return (
      <div className="mobile-board">
        <div className="empty-state" style={{ padding: '48px 24px' }}>
          <p className="empty-state-text">Nenhuma categoria ainda. Crie a primeira para comecar.</p>
          <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => onAddColumn()}>
            Criar categoria
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mobile-board">
      <div className="mobile-tabs-row">
        <button className="mobile-tab-arrow" onClick={() => goToOffset(-1)} disabled={activeIndex <= 0} aria-label="Categoria anterior">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="mobile-tabs-scroll">
          {columns.map(column => (
            <button
              key={column.id}
              ref={el => { tabRefs.current[column.id] = el; }}
              className={`mobile-tab ${column.id === activeColumnId ? 'active' : ''}`}
              onClick={() => setActiveColumnId(column.id)}
            >
              <span className="mobile-tab-dot" style={{ background: column.color }} />
              {column.title}
              <span className="mobile-tab-count">{column.tasks.length}</span>
            </button>
          ))}
          <button className="mobile-tab mobile-tab-add" onClick={() => onAddColumn()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Categoria
          </button>
        </div>
        <button className="mobile-tab-arrow" onClick={() => goToOffset(1)} disabled={activeIndex >= columns.length - 1} aria-label="Proxima categoria">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </button>
      </div>

      <div className="mobile-board-header">
        {isEditingTitle ? (
          <input
            className="column-title-input"
            value={editTitle}
            autoFocus
            onChange={e => setEditTitle(e.target.value)}
            onBlur={handleSaveTitle}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
          />
        ) : (
          <h2 className="mobile-board-title">
            <span className="column-color-dot" style={{ background: activeColumn.color }} />
            {activeColumn.title}
          </h2>
        )}

        <div className="dropdown" ref={menuRef}>
          <button className="column-menu-btn" style={{ opacity: 1 }} onClick={() => setShowMenu(v => !v)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          {showMenu && (
            <div className="dropdown-menu">
              <button className="dropdown-item" onClick={() => { setEditTitle(activeColumn.title); setIsEditingTitle(true); setShowMenu(false); }}>
                Renomear
              </button>
              <button className="dropdown-item" onClick={() => setShowColors(v => !v)}>
                Mudar cor
              </button>
              {showColors && (
                <div className="color-picker" style={{ padding: '8px' }}>
                  {COLORS.map(c => (
                    <div key={c} className={`color-swatch ${activeColumn.color === c ? 'selected' : ''}`} style={{ background: c }}
                      onClick={() => { onUpdateColumn(activeColumn.id, { color: c }); setShowColors(false); setShowMenu(false); }} />
                  ))}
                </div>
              )}
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={() => { onDeleteColumn(activeColumn.id); setShowMenu(false); }}>
                Excluir categoria
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mobile-board-body">
        {activeColumn.tasks.length === 0 && (
          <div className="empty-state" style={{ padding: '32px 16px' }}>
            <p className="empty-state-text">Nenhuma tarefa em "{activeColumn.title}". Adicione abaixo.</p>
          </div>
        )}
        {activeColumn.tasks.map(task => (
          <TaskCard
            key={task.id}
            task={task}
            dragDisabled
            onClick={onTaskClick}
            onToggleComplete={onToggleComplete}
            onToggleSubtask={onToggleSubtask}
            onAddSubtask={onAddSubtask}
          />
        ))}
      </div>

      <div className="mobile-board-footer">
        <input
          className="form-input"
          value={newTaskTitle}
          onChange={e => setNewTaskTitle(e.target.value)}
          placeholder={`Nova tarefa em "${activeColumn.title}"`}
          onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(); }}
        />
        <button className="btn btn-primary" onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
          Adicionar
        </button>
      </div>
    </div>
  );
}
