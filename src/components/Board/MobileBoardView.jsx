import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  DndContext, DragOverlay, MouseSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
  useDroppable, pointerWithin, closestCenter, MeasuringStrategy, useDndContext,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import TaskCard from './TaskCard';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#14b8a6'];
const TAB_HOVER_SWITCH_MS = 450;

// Abas tem prioridade: se o dedo esta sobre uma aba, o alvo e ela; senao,
// o card/lista mais proximo. Categorias ocultas (tamanho zero) sao ignoradas.
function collisionDetection(args) {
  const droppableContainers = args.droppableContainers.filter(container => {
    const rect = args.droppableRects.get(container.id);
    return rect && rect.width > 0 && rect.height > 0;
  });
  const visibleArgs = { ...args, droppableContainers };
  const within = pointerWithin(visibleArgs);
  const tab = within.find(item => String(item.id).startsWith('tab:'));
  if (tab) return [tab];
  if (within.length) return within;
  return closestCenter(visibleArgs);
}

// A categoria que acabou de aparecer foi medida quando estava oculta
// (tamanho zero); remede para que seus cards virem alvos de soltura.
function RemeasureOnTabChange({ trigger }) {
  const { measureDroppableContainers, droppableContainers } = useDndContext();
  const latest = useRef({ measureDroppableContainers, droppableContainers });
  latest.current = { measureDroppableContainers, droppableContainers };
  useEffect(() => {
    const remeasure = () => {
      const { measureDroppableContainers: measure, droppableContainers: containers } = latest.current;
      measure([...containers.keys()]);
    };
    const frame = requestAnimationFrame(remeasure);
    const timer = setTimeout(remeasure, 120);
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, [trigger]);
  return null;
}

function MobileTab({ column, active, onSelect, isDragging, tabRef }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tab:${column.id}`, data: { type: 'tab', columnId: column.id } });
  return (
    <button
      ref={node => { setNodeRef(node); tabRef(node); }}
      className={`mobile-tab ${active ? 'active' : ''} ${isOver ? 'drop-over' : ''} ${isDragging ? 'drop-ready' : ''}`}
      onClick={() => onSelect(column.id)}
    >
      <span className="mobile-tab-dot" style={{ background: column.color }} />
      {column.title}
      <span className="mobile-tab-count">{column.tasks.length}</span>
    </button>
  );
}

function MobileList({ column, children, isDragging }) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${column.id}`, data: { type: 'list', columnId: column.id } });
  return (
    <div ref={setNodeRef} className={`mobile-board-body ${isOver && isDragging ? 'drop-over' : ''}`}>
      {children}
    </div>
  );
}

// Kanban para celular: uma categoria por vez, abas para trocar e arrastar
// com toque longo (segure ~0,2 s no card ou na subtarefa).
export default function MobileBoardView({
  columns, onAddTask, onUpdateColumn, onDeleteColumn, onAddColumn,
  onTaskClick, onToggleComplete, onToggleSubtask, onAddSubtask,
  onDeleteTask, onDeleteSubtask, onClearCompleted,
  onMoveTask, onReorderTask, onConvertSubtaskToTask, onMoveSubtaskToTask, dragEnabled,
}) {
  const [activeColumnId, setActiveColumnId] = useState(columns[0]?.id || '');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [dragItem, setDragItem] = useState(null);
  const menuRef = useRef(null);
  const tabRefs = useRef({});
  const hoverTimer = useRef(null);
  const hoverTab = useRef(null);

  const sensors = useSensors(
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

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
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, []);

  const findColumnOfTask = useCallback(
    taskId => columns.find(column => column.tasks.some(task => task.id === taskId))?.id || null,
    [columns],
  );

  const clearHover = () => {
    clearTimeout(hoverTimer.current);
    hoverTab.current = null;
  };

  const handleDragStart = ({ active }) => {
    const data = active.data.current;
    if (data?.type === 'task') setDragItem({ type: 'task', task: data.task });
    else if (data?.type === 'subtask') setDragItem({ type: 'subtask', subtask: data.subtask, parentTaskId: data.parentTaskId });
    try { navigator.vibrate?.(12); } catch { /* sem vibracao no iOS */ }
  };

  const handleDragOver = ({ over }) => {
    const data = over?.data.current;
    if (data?.type === 'tab' && data.columnId !== activeColumnId) {
      if (hoverTab.current === data.columnId) return;
      clearHover();
      hoverTab.current = data.columnId;
      // Segurar sobre a aba abre a categoria para soltar numa posicao exata.
      hoverTimer.current = setTimeout(() => setActiveColumnId(data.columnId), TAB_HOVER_SWITCH_MS);
    } else if (data?.type !== 'tab') {
      clearHover();
    }
  };

  const handleDragEnd = ({ active, over }) => {
    clearHover();
    setDragItem(null);
    if (!over) return;
    const source = active.data.current;
    const target = over.data.current;
    const targetColumnId = target?.type === 'task' ? findColumnOfTask(over.id) : target?.columnId;
    if (!targetColumnId) return;

    if (source?.type === 'task') {
      const fromColumnId = findColumnOfTask(active.id);
      if (!fromColumnId) return;
      if (target?.type === 'task') {
        if (fromColumnId === targetColumnId) {
          if (active.id !== over.id) onReorderTask(fromColumnId, active.id, over.id);
        } else {
          onMoveTask(active.id, over.id, fromColumnId, targetColumnId);
        }
      } else if (fromColumnId !== targetColumnId) {
        onMoveTask(active.id, targetColumnId, fromColumnId, targetColumnId);
      }
      if (target?.type === 'tab') setActiveColumnId(targetColumnId);
      return;
    }

    if (source?.type === 'subtask') {
      if (target?.type === 'task') {
        if (over.id !== source.parentTaskId) onMoveSubtaskToTask(source.parentTaskId, source.subtask.id, over.id);
      } else {
        onConvertSubtaskToTask(source.parentTaskId, source.subtask.id, targetColumnId);
        if (target?.type === 'tab') setActiveColumnId(targetColumnId);
      }
    }
  };

  const activeIndex = columns.findIndex(c => c.id === activeColumnId);
  const activeColumn = columns[activeIndex] || null;

  const goToOffset = (offset) => {
    const nextIndex = activeIndex + offset;
    if (nextIndex >= 0 && nextIndex < columns.length) setActiveColumnId(columns[nextIndex].id);
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
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => { clearHover(); setDragItem(null); }}
    >
      <RemeasureOnTabChange trigger={activeColumnId} />
      <div className={`mobile-board ${dragItem ? 'is-dragging' : ''}`}>
        <div className="mobile-tabs-row">
          <button className="mobile-tab-arrow" onClick={() => goToOffset(-1)} disabled={activeIndex <= 0} aria-label="Categoria anterior">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
          </button>
          <div className="mobile-tabs-scroll">
            {columns.map(column => (
              <MobileTab
                key={column.id}
                column={column}
                active={column.id === activeColumnId}
                isDragging={Boolean(dragItem)}
                onSelect={setActiveColumnId}
                tabRef={el => { tabRefs.current[column.id] = el; }}
              />
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

        {dragItem ? (
          <p className="mobile-drag-hint">Solte numa aba para mudar de categoria, ou segure sobre a aba para abri-la</p>
        ) : (
          <div className="mobile-board-header">
            {isEditingTitle ? (
              <input
                className="column-title-input"
                value={editTitle}
                autoFocus
                maxLength={120}
                onChange={e => setEditTitle(e.target.value)}
                onBlur={handleSaveTitle}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); if (e.key === 'Escape') setIsEditingTitle(false); }}
              />
            ) : (
              <h2 className="mobile-board-title">
                <span className="column-color-dot" style={{ background: activeColumn.color }} />
                {activeColumn.title}
                <span className="mobile-board-subtitle">{activeIndex + 1} de {columns.length}</span>
              </h2>
            )}

            <div className="dropdown" ref={menuRef}>
              <button className="column-menu-btn" style={{ opacity: 1 }} onClick={() => setShowMenu(v => !v)} aria-label="Opcoes da categoria">
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
                  <button className="dropdown-item" onClick={() => { onClearCompleted?.(activeColumn.id); setShowMenu(false); }}>
                    Excluir concluidas
                  </button>
                  <div className="dropdown-divider" />
                  <button className="dropdown-item danger" onClick={() => { onDeleteColumn(activeColumn.id); setShowMenu(false); }}>
                    Excluir categoria
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Todas as categorias ficam montadas (so a ativa visivel): se o card
            arrastado sumisse ao trocar de aba, o arraste seria cancelado. */}
        {columns.map(column => (
          <div key={column.id} className="mobile-column-pane" hidden={column.id !== activeColumnId}>
            <SortableContext items={column.tasks.map(task => task.id)} strategy={verticalListSortingStrategy}>
              <MobileList column={column} isDragging={Boolean(dragItem)}>
                {column.tasks.length === 0 && (
                  <div className="empty-state" style={{ padding: '32px 16px' }}>
                    <p className="empty-state-text">
                      {dragItem ? 'Solte aqui' : `Nenhuma tarefa em "${column.title}". Adicione abaixo.`}
                    </p>
                  </div>
                )}
                {column.tasks.map(task => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    dragDisabled={!dragEnabled}
                    touchFriendly
                    activeDragType={dragItem?.type}
                    activeSubtaskParentId={dragItem?.type === 'subtask' ? dragItem.parentTaskId : null}
                    onClick={onTaskClick}
                    onToggleComplete={onToggleComplete}
                    onToggleSubtask={onToggleSubtask}
                    onAddSubtask={onAddSubtask}
                    onDelete={onDeleteTask}
                    onDeleteSubtask={onDeleteSubtask}
                  />
                ))}
              </MobileList>
            </SortableContext>
          </div>
        ))}

        <div className="mobile-board-footer">
          <input
            className="form-input"
            value={newTaskTitle}
            maxLength={120}
            onChange={e => setNewTaskTitle(e.target.value)}
            placeholder={`Nova tarefa em "${activeColumn.title}"`}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateTask(); }}
          />
          <button className="btn btn-primary" onClick={handleCreateTask} disabled={!newTaskTitle.trim()}>
            Adicionar
          </button>
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 180 }}>
        {dragItem?.type === 'task' && (
          <div className="task-card-overlay mobile-overlay">
            <div className="task-card-title">{dragItem.task.title}</div>
            {dragItem.task.subtitle && <div className="task-card-subtitle">{dragItem.task.subtitle}</div>}
          </div>
        )}
        {dragItem?.type === 'subtask' && (
          <div className="subtask-overlay">
            <div className="subtask-checkbox" />
            <span>{dragItem.subtask.text}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
