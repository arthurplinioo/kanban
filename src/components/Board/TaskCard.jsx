import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { isOverdue, isDueToday, formatTaskSchedule } from '../../utils/dateUtils';
import DraggableSubtask from './DraggableSubtask';

const priorityLabels = { low: 'Baixa', medium: 'Média', high: 'Alta', urgent: 'Urgente' };

export default function TaskCard({ task, onClick, onToggleComplete, onToggleSubtask, onAddSubtask, activeDragType, activeSubtaskParentId }) {
  const [isSubtasksExpanded, setIsSubtasksExpanded] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');

  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
    data: { type: 'task', task },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const completedSubs = (task.subtasks || []).filter(s => s.completed).length;
  const totalSubs = (task.subtasks || []).length;
  const overdue = isOverdue(task.dueDate) && !task.completed;
  const today = isDueToday(task.dueDate);
  const isSubtaskDropTarget = activeDragType === 'subtask' && activeSubtaskParentId !== task.id && isOver;

  const handleCreateSubtask = (event) => {
    event.stopPropagation();
    if (!newSubtask.trim()) return;
    onAddSubtask?.(task.id, newSubtask.trim());
    setNewSubtask('');
    setIsSubtasksExpanded(true);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isDragging ? 'is-dragging' : ''} ${task.completed ? 'completed' : ''} ${isSubtaskDropTarget ? 'subtask-drop-target' : ''}`}
      onClick={() => onClick?.(task)}
    >
      {task.labels?.[0] && <div className="task-card-color-bar" style={{ background: task.labels[0] }} />}
      <div className="task-card-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="task-card-title">{task.title}</div>
          {task.subtitle && <div className="task-card-subtitle">{task.subtitle}</div>}
        </div>
        <div
          className={`task-card-checkbox ${task.completed ? 'checked' : ''}`}
          onClick={e => { e.stopPropagation(); onToggleComplete?.(task.id); }}
        >
          {task.completed && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          )}
        </div>
      </div>
      {task.description && <div className="task-card-description">{task.description}</div>}
      <div className="task-card-badges">
        {task.priority && (
          <span className={`task-badge priority-${task.priority}`}>
            {priorityLabels[task.priority]}
          </span>
        )}
        {task.dueDate && (
          <span className={`task-badge ${overdue ? 'due-overdue' : today ? 'due-today' : 'due-date'}`}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            {formatTaskSchedule(task)}
          </span>
        )}
        {task.googleEventId && <span className="task-badge synced">📅 Sync</span>}
      </div>
      {totalSubs > 0 && (
        <div className="task-card-footer" onClick={(e) => { e.stopPropagation(); setIsSubtasksExpanded(!isSubtasksExpanded); }}>
          <div className="task-subtask-progress">
            <div className="task-progress-bar">
              <div className="task-progress-fill" style={{ width: `${(completedSubs / totalSubs) * 100}%` }} />
            </div>
            <span>{completedSubs}/{totalSubs}</span>
          </div>
          <button className="subtask-toggle-btn">
            <svg style={{ transform: isSubtasksExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </div>
      )}
      {totalSubs > 0 && isSubtasksExpanded && (
        <div className="task-card-subtasks-list" onClick={(e) => e.stopPropagation()}>
          {task.subtasks.map(st => (
            <DraggableSubtask key={st.id} subtask={st} parentTaskId={task.id} onToggle={onToggleSubtask} />
          ))}
        </div>
      )}
      <div className="task-card-subtask-creator" onClick={(e) => e.stopPropagation()}>
        <input
          className="task-card-subtask-input"
          value={newSubtask}
          onChange={(event) => setNewSubtask(event.target.value)}
          onFocus={() => setIsSubtasksExpanded(true)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') handleCreateSubtask(event);
          }}
          placeholder="Adicionar subtarefa no card"
        />
        <button
          className="task-card-subtask-add"
          onClick={handleCreateSubtask}
          disabled={!newSubtask.trim()}
        >
          +
        </button>
      </div>
    </div>
  );
}
