import React from 'react';
import { useDraggable } from '@dnd-kit/core';

export default function DraggableSubtask({ subtask, parentTaskId, onToggle, dragDisabled = false }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `subtask-${subtask.id}`,
    data: {
      type: 'subtask',
      subtask,
      parentTaskId
    },
    disabled: dragDisabled,
  });
  const dragProps = dragDisabled ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      className={`task-subtask-item ${dragDisabled ? 'no-drag' : ''} ${isDragging ? 'is-dragging' : ''} ${subtask.completed ? 'completed' : ''}`}
      {...dragProps}
      onClick={(e) => {
        // Prevent drag click from triggering other things
        e.stopPropagation();
      }}
    >
      <div 
        className={`subtask-checkbox ${subtask.completed ? 'checked' : ''}`}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(parentTaskId, subtask.id);
        }}
      >
        {subtask.completed && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        )}
      </div>
      <span className="subtask-text">{subtask.text}</span>
      <div className="subtask-drag-handle">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
      </div>
    </div>
  );
}
