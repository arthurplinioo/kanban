import { useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '../utils/idGenerator';
import { storage } from '../services/storage';

const COLUMN_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

const defaultBoard = {
  title: 'Meu Quadro',
  columns: [
    {
      id: generateId(), title: 'A Fazer', color: '#6366f1', tasks: [
        { id: generateId(), title: 'Bem-vindo ao TaskFlow!', subtitle: 'Seu organizador Kanban', description: 'Arraste tarefas entre colunas, adicione subtarefas e muito mais.', priority: 'low', dueDate: null, subtasks: [{ id: generateId(), text: 'Explorar o quadro', completed: false }, { id: generateId(), text: 'Criar uma tarefa', completed: false }], completed: false, googleEventId: null, syncWithGoogle: false, createdAt: new Date().toISOString(), labels: [] },
      ]
    },
    { id: generateId(), title: 'Em Progresso', color: '#f59e0b', tasks: [] },
    { id: generateId(), title: 'Concluído', color: '#10b981', tasks: [] },
  ]
};

export function useBoard() {
  const [board, setBoard] = useState(() => {
    const saved = storage.loadBoard();
    return saved || defaultBoard;
  });
  const [toasts, setToasts] = useState([]);
  const saveTimer = useRef(null);

  // Auto-save debounced
  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.saveBoard(board);
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [board]);

  const showToast = useCallback((message, type = 'success') => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  const updateBoardTitle = useCallback((title) => {
    setBoard(prev => ({ ...prev, title }));
  }, []);

  const addColumn = useCallback((title, color) => {
    const newCol = {
      id: generateId(),
      title: title || 'Nova Categoria',
      color: color || COLUMN_COLORS[Math.floor(Math.random() * COLUMN_COLORS.length)],
      tasks: [],
    };
    setBoard(prev => ({ ...prev, columns: [...prev.columns, newCol] }));
    showToast(`Categoria "${newCol.title}" criada`);
  }, [showToast]);

  const updateColumn = useCallback((columnId, updates) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => c.id === columnId ? { ...c, ...updates } : c),
    }));
  }, []);

  const deleteColumn = useCallback((columnId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.filter(c => c.id !== columnId),
    }));
    showToast('Categoria removida');
  }, [showToast]);

  const addTask = useCallback((columnId, taskData = {}) => {
    const newTask = {
      id: generateId(),
      title: taskData.title || 'Nova Tarefa',
      subtitle: taskData.subtitle || '',
      description: taskData.description || '',
      priority: taskData.priority || null,
      dueDate: taskData.dueDate || null,
      dueTime: taskData.dueTime || '',
      endDate: taskData.endDate || null,
      endTime: taskData.endTime || '',
      recurrence: taskData.recurrence || 'none',
      reminderMinutes: taskData.reminderMinutes ?? 30,
      subtasks: taskData.subtasks || [],
      completed: false,
      googleEventId: null,
      syncWithGoogle: false,
      createdAt: new Date().toISOString(),
      labels: taskData.labels || [],
    };
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c =>
        c.id === columnId ? { ...c, tasks: [...c.tasks, newTask] } : c
      ),
    }));
    return newTask;
  }, []);

  const updateTask = useCallback((taskId, updates) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t),
      })),
    }));
  }, []);

  const deleteTask = useCallback((taskId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.filter(t => t.id !== taskId),
      })),
    }));
    showToast('Tarefa removida');
  }, [showToast]);

  const toggleTaskComplete = useCallback((taskId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed } : t),
      })),
    }));
  }, []);

  const addSubtask = useCallback((taskId, text) => {
    const sub = { id: generateId(), text, completed: false };
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t =>
          t.id === taskId ? { ...t, subtasks: [...(t.subtasks || []), sub] } : t
        ),
      })),
    }));
    return sub;
  }, []);

  const toggleSubtask = useCallback((taskId, subtaskId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t =>
          t.id === taskId ? {
            ...t,
            subtasks: t.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s),
          } : t
        ),
      })),
    }));
  }, []);

  const deleteSubtask = useCallback((taskId, subtaskId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) } : t
        ),
      })),
    }));
  }, []);

  const convertSubtaskToTask = useCallback((parentTaskId, subtaskId, targetColumnId, beforeTaskId = null) => {
    setBoard(prev => {
      let subtaskText = '';
      let subtaskCompleted = false;

      // Extract subtask
      const updatedColumns = prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t => {
          if (t.id === parentTaskId) {
            const st = t.subtasks?.find(s => s.id === subtaskId);
            if (st) {
              subtaskText = st.text;
              subtaskCompleted = st.completed;
            }
            return { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId) };
          }
          return t;
        })
      }));

      if (!subtaskText) return prev;

      // Add as new task
      const newTask = {
        id: generateId(),
        title: subtaskText,
        subtitle: '',
        description: '',
        priority: null,
        dueDate: null,
        dueTime: '',
        endDate: null,
        endTime: '',
        recurrence: 'none',
        reminderMinutes: 30,
        subtasks: [],
        completed: subtaskCompleted,
        googleEventId: null,
        syncWithGoogle: false,
        createdAt: new Date().toISOString(),
        labels: [],
      };

      return {
        ...prev,
        columns: updatedColumns.map(c => {
          if (c.id !== targetColumnId) return c;

          const nextTasks = [...c.tasks];
          const insertIndex = beforeTaskId ? nextTasks.findIndex(task => task.id === beforeTaskId) : -1;

          if (insertIndex === -1) nextTasks.push(newTask);
          else nextTasks.splice(insertIndex, 0, newTask);

          return { ...c, tasks: nextTasks };
        })
      };
    });
  }, []);

  const moveSubtaskToTask = useCallback((parentTaskId, subtaskId, targetTaskId, targetIndex = null) => {
    setBoard(prev => {
      let subtask = null;

      const removedSubtaskCols = prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t => {
          if (t.id === parentTaskId) {
            subtask = t.subtasks?.find(s => s.id === subtaskId);
            return { ...t, subtasks: (t.subtasks || []).filter(s => s.id !== subtaskId) };
          }
          return t;
        })
      }));

      if (!subtask) return prev;

      return {
        ...prev,
        columns: removedSubtaskCols.map(c => ({
          ...c,
          tasks: c.tasks.map(t => {
            if (t.id !== targetTaskId) return t;
            const nextSubtasks = [...(t.subtasks || [])];
            const insertIndex = Number.isInteger(targetIndex) ? targetIndex : nextSubtasks.length;
            nextSubtasks.splice(Math.max(0, Math.min(insertIndex, nextSubtasks.length)), 0, subtask);
            return { ...t, subtasks: nextSubtasks };
          })
        }))
      };
    });
  }, []);

  const moveTask = useCallback((activeId, overId, activeContainerId, overContainerId) => {
    setBoard(prev => {
      const cols = [...prev.columns];
      const srcIdx = cols.findIndex(c => c.id === activeContainerId);
      const destIdx = cols.findIndex(c => c.id === overContainerId);
      if (srcIdx === -1 || destIdx === -1) return prev;

      const srcTasks = [...cols[srcIdx].tasks];
      const taskIdx = srcTasks.findIndex(t => t.id === activeId);
      if (taskIdx === -1) return prev;

      const [task] = srcTasks.splice(taskIdx, 1);
      cols[srcIdx] = { ...cols[srcIdx], tasks: srcTasks };

      const destTasks = [...cols[destIdx].tasks];
      const overIdx = destTasks.findIndex(t => t.id === overId);
      if (overIdx === -1) {
        destTasks.push(task);
      } else {
        destTasks.splice(overIdx, 0, task);
      }
      cols[destIdx] = { ...cols[destIdx], tasks: destTasks };

      return { ...prev, columns: cols };
    });
  }, []);

  const reorderTask = useCallback((columnId, activeId, overId) => {
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => {
        if (c.id !== columnId) return c;
        const tasks = [...c.tasks];
        const oldIdx = tasks.findIndex(t => t.id === activeId);
        const newIdx = tasks.findIndex(t => t.id === overId);
        if (oldIdx === -1 || newIdx === -1) return c;
        const [item] = tasks.splice(oldIdx, 1);
        tasks.splice(newIdx, 0, item);
        return { ...c, tasks };
      }),
    }));
  }, []);

  const reorderColumns = useCallback((activeId, overId) => {
    setBoard(prev => {
      const cols = [...prev.columns];
      const oldIdx = cols.findIndex(c => c.id === activeId);
      const newIdx = cols.findIndex(c => c.id === overId);
      if (oldIdx === -1 || newIdx === -1) return prev;
      const [item] = cols.splice(oldIdx, 1);
      cols.splice(newIdx, 0, item);
      return { ...prev, columns: cols };
    });
  }, []);

  const getAllTasks = useCallback(() => {
    return board.columns.flatMap(c => c.tasks.map(t => ({ ...t, columnId: c.id, columnTitle: c.title, columnColor: c.color })));
  }, [board]);

  const findTask = useCallback((taskId) => {
    for (const c of board.columns) {
      const t = c.tasks.find(t => t.id === taskId);
      if (t) return { ...t, columnId: c.id, columnTitle: c.title };
    }
    return null;
  }, [board]);

  return {
    board, toasts, updateBoardTitle,
    addColumn, updateColumn, deleteColumn,
    addTask, updateTask, deleteTask, toggleTaskComplete,
    addSubtask, toggleSubtask, deleteSubtask,
    convertSubtaskToTask, moveSubtaskToTask,
    moveTask, reorderTask, reorderColumns,
    getAllTasks, findTask, showToast,
    setBoard,
  };
}
