import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../common/Modal';

const LABEL_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6', '#f97316', '#84cc16'];
const PRIORITY_LABELS = { low: 'Baixa', medium: 'Media', high: 'Alta', urgent: 'Urgente' };

export default function TaskDetailModal({
  task,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  isGoogleConnected,
  onSyncGoogle,
  columns = [],
  defaultColumnId = '',
  isCreateMode = false,
}) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState(null);
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurrence, setRecurrence] = useState('none');
  const [reminderMinutes, setReminderMinutes] = useState(30);
  const [labels, setLabels] = useState([]);
  const [syncWithGoogle, setSyncWithGoogle] = useState(false);
  const [newSubtask, setNewSubtask] = useState('');
  const [selectedColumnId, setSelectedColumnId] = useState('');

  const resolvedDefaultColumnId = useMemo(
    () => task?.columnId || defaultColumnId || columns[0]?.id || '',
    [columns, defaultColumnId, task]
  );

  useEffect(() => {
    if (!task) return;
    setTitle(task.title || '');
    setSubtitle(task.subtitle || '');
    setDescription(task.description || '');
    setPriority(task.priority || null);
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : '');
    setDueTime(task.dueTime || '');
    setEndDate(task.endDate ? task.endDate.slice(0, 10) : '');
    setEndTime(task.endTime || '');
    setRecurrence(task.recurrence || 'none');
    setReminderMinutes(task.reminderMinutes ?? 30);
    setLabels(task.labels || []);
    setSyncWithGoogle(task.syncWithGoogle || false);
    setSelectedColumnId(resolvedDefaultColumnId);
    setNewSubtask('');
  }, [resolvedDefaultColumnId, task]);

  if (!task) return null;

  const handleSave = async () => {
    const payload = {
      title: title.trim() || 'Sem titulo',
      subtitle,
      description,
      priority,
      dueDate: dueDate || null,
      dueTime,
      endDate: endDate || null,
      endTime,
      recurrence,
      reminderMinutes: Number(reminderMinutes),
      labels,
      syncWithGoogle,
      columnId: selectedColumnId || resolvedDefaultColumnId,
    };

    if (isCreateMode) {
      await onUpdate?.(payload);
    } else {
      await onUpdate?.(task.id, payload);
    }
    onClose();
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim() || isCreateMode) return;
    onAddSubtask(task.id, newSubtask.trim());
    setNewSubtask('');
  };

  const toggleLabel = (color) => {
    setLabels(prev => prev.includes(color) ? prev.filter(c => c !== color) : [...prev, color]);
  };

  const footer = (
    <>
      {!isCreateMode && (
        <button
          className="btn btn-danger"
          onClick={() => {
            onDelete?.(task.id);
            onClose();
          }}
        >
          Excluir
        </button>
      )}
      <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
      <button className="btn btn-primary" onClick={handleSave}>
        {isCreateMode ? 'Criar' : 'Salvar'}
      </button>
    </>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isCreateMode ? 'Novo compromisso' : 'Editar tarefa'}
      footer={footer}
    >
      <div className="form-group">
        <label className="form-label">Titulo</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder="Titulo da tarefa" />
      </div>

      <div className="form-group">
        <label className="form-label">Categoria</label>
        <select className="form-input" value={selectedColumnId} onChange={e => setSelectedColumnId(e.target.value)}>
          {columns.map(column => (
            <option key={column.id} value={column.id}>{column.title}</option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Subtitulo</label>
        <input className="form-input" value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Subtitulo opcional" />
      </div>

      <div className="form-group">
        <label className="form-label">Descricao</label>
        <textarea className="form-input" value={description} onChange={e => setDescription(e.target.value)} placeholder="Descreva a tarefa..." rows="3" />
      </div>

      <div className="form-group">
        <label className="form-label">Prioridade</label>
        <div className="priority-select">
          {['low', 'medium', 'high', 'urgent'].map(level => (
            <button
              key={level}
              type="button"
              className={`priority-option ${level} ${priority === level ? 'selected' : ''}`}
              onClick={() => setPriority(priority === level ? null : level)}
            >
              {PRIORITY_LABELS[level]}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Data</label>
        <input className="form-input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
      </div>

      <div className="task-form-grid">
        <div className="form-group">
          <label className="form-label">Hora inicial</label>
          <input className="form-input" type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Hora final</label>
          <input className="form-input" type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
        </div>
      </div>

      <div className="task-form-grid">
        <div className="form-group">
          <label className="form-label">Data final</label>
          <input className="form-input" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Recorrencia</label>
          <select className="form-input" value={recurrence} onChange={e => setRecurrence(e.target.value)}>
            <option value="none">Sem repeticao</option>
            <option value="daily">Diariamente</option>
            <option value="weekly">Semanalmente</option>
            <option value="monthly">Mensalmente</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">Lembrete</label>
        <select className="form-input" value={reminderMinutes} onChange={e => setReminderMinutes(e.target.value)}>
          <option value={0}>Na hora</option>
          <option value={10}>10 minutos antes</option>
          <option value={30}>30 minutos antes</option>
          <option value={60}>1 hora antes</option>
          <option value={1440}>1 dia antes</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-label">Etiquetas</label>
        <div className="color-picker">
          {LABEL_COLORS.map(color => (
            <div
              key={color}
              className={`color-swatch ${labels.includes(color) ? 'selected' : ''}`}
              style={{ background: color }}
              onClick={() => toggleLabel(color)}
            />
          ))}
        </div>
      </div>

      {!isCreateMode && (
        <div className="form-group">
          <label className="form-label">
            Subtarefas ({(task.subtasks || []).filter(item => item.completed).length}/{(task.subtasks || []).length})
          </label>
          <div className="subtask-list">
            {(task.subtasks || []).map(subtask => (
              <div key={subtask.id} className="subtask-item">
                <div
                  className={`subtask-checkbox ${subtask.completed ? 'checked' : ''}`}
                  onClick={() => onToggleSubtask(task.id, subtask.id)}
                >
                  {subtask.completed && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <span className={`subtask-text ${subtask.completed ? 'completed' : ''}`}>{subtask.text}</span>
                <button className="subtask-delete" onClick={() => onDeleteSubtask(task.id, subtask.id)}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}
            <div className="subtask-item" style={{ gap: '8px' }}>
              <input
                className="subtask-input"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                placeholder="Nova subtarefa..."
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddSubtask();
                }}
              />
              <button className="btn btn-sm btn-primary" onClick={handleAddSubtask} disabled={!newSubtask.trim()}>
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {isGoogleConnected && dueDate && (
        <div className="form-group">
          <label className="form-label task-sync-label">
            <input
              type="checkbox"
              checked={syncWithGoogle}
              onChange={e => setSyncWithGoogle(e.target.checked)}
              style={{ width: 16, height: 16, accentColor: 'var(--primary-500)' }}
            />
            Sincronizar com Google Agenda
          </label>
          {syncWithGoogle && (
            <p className="task-sync-hint">
              Ao salvar, a tarefa sera enviada para o Google Agenda e mantida em sincronia.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
