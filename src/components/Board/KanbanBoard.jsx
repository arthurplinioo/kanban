import React, { useState, useMemo } from 'react';
import { DndContext, DragOverlay, closestCorners, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import Column from './Column';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';
import { isDueToday, isOverdue } from '../../utils/dateUtils';

export default function KanbanBoard({ board, onUpdateBoardTitle, onAddColumn, onUpdateColumn, onDeleteColumn,
  onAddTask, onUpdateTask, onDeleteTask, onToggleComplete, onAddSubtask, onToggleSubtask, onDeleteSubtask,
  onMoveTask, onReorderTask, onReorderColumns, onConvertSubtaskToTask, onMoveSubtaskToTask, isGoogleConnected, onSyncGoogle, searchQuery }) {

  const [activeItem, setActiveItem] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [boardTitle, setBoardTitle] = useState(board.title);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor)
  );

  const columnIds = useMemo(() => board.columns.map(c => c.id), [board.columns]);
  const boardInsights = useMemo(() => {
    const tasks = board.columns.flatMap(column => column.tasks);
    const total = tasks.length;
    const completed = tasks.filter(task => task.completed).length;
    const subtasks = tasks.flatMap(task => task.subtasks || []);
    const completedSubtasks = subtasks.filter(subtask => subtask.completed).length;

    return {
      total,
      completed,
      overdue: tasks.filter(task => isOverdue(task.dueDate) && !task.completed).length,
      today: tasks.filter(task => isDueToday(task.dueDate) && !task.completed).length,
      progress: total ? Math.round((completed / total) * 100) : 0,
      subtaskProgress: subtasks.length ? Math.round((completedSubtasks / subtasks.length) * 100) : 0,
    };
  }, [board.columns]);

  const filteredColumns = useMemo(() => {
    if (!searchQuery) return board.columns;
    const q = searchQuery.toLowerCase();
    return board.columns.map(c => ({
      ...c,
      tasks: c.tasks.filter(t =>
        t.title.toLowerCase().includes(q) ||
        (t.subtitle || '').toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q) ||
        (t.subtasks || []).some(subtask => subtask.text.toLowerCase().includes(q))
      ),
    }));
  }, [board.columns, searchQuery]);

  const findContainer = (id) => {
    // Check if id is a column
    if (board.columns.find(c => c.id === id)) return id;
    // Find which column contains this task
    for (const col of board.columns) {
      if (col.tasks.find(t => t.id === id)) return col.id;
    }
    return null;
  };

  const handleDragStart = (event) => {
    const { active } = event;
    const type = active.data.current?.type;
    if (type === 'task') {
      setActiveItem({ type: 'task', data: active.data.current.task });
    } else if (type === 'column') {
      const col = board.columns.find(c => c.id === active.id);
      setActiveItem({ type: 'column', data: col });
    } else if (type === 'subtask') {
      setActiveItem({
        type: 'subtask',
        data: {
          ...active.data.current.subtask,
          parentTaskId: active.data.current.parentTaskId,
        },
      });
    }
  };

  const handleDragOver = (event) => {
    const { active, over } = event;
    if (!over) return;
    const activeType = active.data.current?.type;
    if (activeType !== 'task') return;

    const activeContainer = findContainer(active.id);
    const overContainer = findContainer(over.id);

    if (!activeContainer || !overContainer || activeContainer === overContainer) return;
    onMoveTask(active.id, over.id, activeContainer, overContainer);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveItem(null);
    if (!over) return;

    const activeType = active.data.current?.type;

    if (activeType === 'column') {
      if (active.id !== over.id) {
        onReorderColumns(active.id, over.id);
      }
      return;
    }

    if (activeType === 'subtask') {
      const parentTaskId = active.data.current.parentTaskId;
      const overType = over.data.current?.type;
      const targetColumnId = overType === 'column' ? over.id : findContainer(over.id);
      
      if (!targetColumnId) return;

      if (overType === 'column') {
        onConvertSubtaskToTask(parentTaskId, active.data.current.subtask.id, targetColumnId);
      } else if (overType === 'task') {
        if (parentTaskId !== over.id) {
          onMoveSubtaskToTask(parentTaskId, active.data.current.subtask.id, over.id);
        }
      }
      return;
    }

    if (activeType === 'task') {
      const activeContainer = findContainer(active.id);
      const overContainer = findContainer(over.id);
      if (!activeContainer || !overContainer) return;

      if (activeContainer === overContainer && active.id !== over.id) {
        onReorderTask(activeContainer, active.id, over.id);
      } else if (activeContainer !== overContainer) {
        onMoveTask(active.id, over.id, activeContainer, overContainer);
      }
    }
  };

  const handleTaskClick = (task) => {
    setSelectedTask(task);
  };

  const handleSaveTitle = () => {
    onUpdateBoardTitle(boardTitle.trim() || 'Meu Quadro');
    setIsEditingTitle(false);
  };

  return (
    <div className="board-container">
      <div className="board-header">
        <div className="board-heading">
          {isEditingTitle ? (
            <input className="board-title-input" value={boardTitle} onChange={e => setBoardTitle(e.target.value)}
              onBlur={handleSaveTitle} onKeyDown={e => { if (e.key === 'Enter') handleSaveTitle(); }}
              autoFocus />
          ) : (
            <h1 className="board-title" onDoubleClick={() => setIsEditingTitle(true)}>{board.title}</h1>
          )}
          <div className="board-insights">
            <span className="board-insight"><strong>{boardInsights.total}</strong> tarefas</span>
            <span className="board-insight accent"><strong>{boardInsights.progress}%</strong> concluido</span>
            <span className={`board-insight ${boardInsights.today ? 'warning' : ''}`}><strong>{boardInsights.today}</strong> hoje</span>
            <span className={`board-insight ${boardInsights.overdue ? 'danger' : ''}`}><strong>{boardInsights.overdue}</strong> atrasadas</span>
            <span className="board-insight"><strong>{boardInsights.subtaskProgress}%</strong> subtarefas</span>
          </div>
        </div>
        <div className="board-actions">
          <button className="btn btn-sm btn-secondary" onClick={() => onAddColumn()}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Categoria
          </button>
        </div>
      </div>

      <DndContext sensors={sensors} collisionDetection={closestCorners}
        onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <SortableContext items={columnIds} strategy={horizontalListSortingStrategy}>
          <div className="board-columns">
            {filteredColumns.map(col => (
              <Column key={col.id} column={col}
                onAddTask={onAddTask} onUpdateColumn={onUpdateColumn} onDeleteColumn={onDeleteColumn}
                onTaskClick={handleTaskClick} onToggleComplete={onToggleComplete}
                onToggleSubtask={onToggleSubtask} onAddSubtask={onAddSubtask}
                activeDragType={activeItem?.type}
                activeSubtaskParentId={activeItem?.type === 'subtask' ? activeItem.data.parentTaskId : null} />
            ))}
            <button className="add-column-btn" onClick={() => onAddColumn()}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Nova Categoria
            </button>
          </div>
        </SortableContext>

        <DragOverlay>
          {activeItem?.type === 'task' && (
            <div className="task-card-overlay">
              <div className="task-card-title">{activeItem.data.title}</div>
              {activeItem.data.subtitle && <div className="task-card-subtitle">{activeItem.data.subtitle}</div>}
            </div>
          )}
          {activeItem?.type === 'subtask' && (
            <div className="subtask-overlay">
              <div className="subtask-checkbox" />
              <span>{activeItem.data.text}</span>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      <TaskDetailModal
        task={selectedTask}
        isOpen={!!selectedTask}
        onClose={() => setSelectedTask(null)}
        onUpdate={onUpdateTask}
        onDelete={(id) => { onDeleteTask(id); setSelectedTask(null); }}
        onAddSubtask={onAddSubtask}
        onToggleSubtask={onToggleSubtask}
        onDeleteSubtask={onDeleteSubtask}
        isGoogleConnected={isGoogleConnected}
        onSyncGoogle={onSyncGoogle}
        columns={board.columns}
      />
    </div>
  );
}
