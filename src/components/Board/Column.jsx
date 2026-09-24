import React, { useState, useRef, useEffect } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import TaskCard from './TaskCard';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#14b8a6'];

export default function Column({ column, onAddTask, onUpdateColumn, onDeleteColumn, onTaskClick, onToggleComplete, onToggleSubtask, onAddSubtask, activeDragType, activeSubtaskParentId }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(column.title);
  const [showMenu, setShowMenu] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  const { attributes, listeners, setNodeRef: setSortableRef, transform, transition } = useSortable({
    id: column.id,
    data: { type: 'column' },
  });

  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: column.id,
    data: { type: 'column', column },
  });

  const style = { transform: CSS.Transform.toString(transform), transition };
  const taskIds = column.tasks.map(t => t.id);

  useEffect(() => {
    if (isEditing && inputRef.current) inputRef.current.focus();
  }, [isEditing]);

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

  const handleSaveTitle = () => {
    if (editTitle.trim()) onUpdateColumn(column.id, { title: editTitle.trim() });
    setIsEditing(false);
  };

  const combinedRef = (node) => {
    setSortableRef(node);
    setDroppableRef(node);
  };

  return (
    <div ref={combinedRef} style={style} className={`column ${isOver ? 'is-over' : ''}`}>
      <div className="column-header" {...attributes} {...listeners}>
        <div className="column-title-area">
          <div className="column-color-dot" style={{ background: column.color }} />
          {isEditing ? (
            <input
              ref={inputRef}
              className="column-title-input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              onBlur={handleSaveTitle}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditing(false); }}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="column-title" onDoubleClick={() => setIsEditing(true)}>{column.title}</span>
          )}
          <span className="column-count">{column.tasks.length}</span>
        </div>
        <div className="dropdown" ref={menuRef}>
          <button className="column-menu-btn" onClick={e => { e.stopPropagation(); setShowMenu(!showMenu); }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
          </button>
          {showMenu && (
            <div className="dropdown-menu" onClick={e => e.stopPropagation()}>
              <button className="dropdown-item" onClick={() => { setIsEditing(true); setShowMenu(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Renomear
              </button>
              <button className="dropdown-item" onClick={() => { setShowColors(!showColors); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
                Mudar Cor
              </button>
              {showColors && (
                <div className="color-picker" style={{ padding: '8px' }}>
                  {COLORS.map(c => (
                    <div key={c} className={`color-swatch ${column.color === c ? 'selected' : ''}`} style={{ background: c }}
                      onClick={() => { onUpdateColumn(column.id, { color: c }); setShowColors(false); setShowMenu(false); }} />
                  ))}
                </div>
              )}
              <div className="dropdown-divider" />
              <button className="dropdown-item danger" onClick={() => { onDeleteColumn(column.id); setShowMenu(false); }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Excluir
              </button>
            </div>
          )}
        </div>
      </div>
      <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
        <div className="column-body">
          {column.tasks.length === 0 && (
            <div className="empty-state" style={{ padding: '24px 16px' }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
              <p className="empty-state-text">Arraste tarefas aqui ou clique em "+" para adicionar</p>
            </div>
          )}
          {column.tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onToggleComplete={onToggleComplete}
              onToggleSubtask={onToggleSubtask}
              onAddSubtask={onAddSubtask}
              activeDragType={activeDragType}
              activeSubtaskParentId={activeSubtaskParentId}
            />
          ))}
        </div>
      </SortableContext>
      <div className="column-footer">
        <button className="add-task-btn" onClick={() => onAddTask(column.id)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Adicionar tarefa
        </button>
      </div>
    </div>
  );
}
