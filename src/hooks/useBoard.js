import { useState, useEffect, useCallback, useRef } from 'react';
import { generateId } from '../utils/idGenerator';
import { storage } from '../services/storage';
import { createDefaultBoard, sanitizeBoard } from '../utils/boardModel';

const COLUMN_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

export function useBoard() {
  const [board, setBoard] = useState(() => {
    const saved = storage.loadBoard('personal');
    return saved ? sanitizeBoard(saved) : createDefaultBoard();
  });
  // Qual quadro esta carregado ('personal' ou id de um quadro compartilhado);
  // define onde a copia local (cache offline) e gravada.
  const [boardKey, setBoardKey] = useState('personal');
  const [toasts, setToasts] = useState([]);
  const saveTimer = useRef(null);
  const latest = useRef({ board, boardKey });
  latest.current = { board, boardKey };

  useEffect(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      storage.saveBoard(board, boardKey);
    }, 300);
    return () => clearTimeout(saveTimer.current);
  }, [board, boardKey]);

  // O iOS congela o app assim que ele vai para segundo plano; o timer acima
  // nunca dispararia. Grava na hora ao sair/ocultar.
  useEffect(() => {
    const flush = () => {
      clearTimeout(saveTimer.current);
      storage.saveBoard(latest.current.board, latest.current.boardKey);
    };
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Troca o quadro exibido. Grava o atual na hora para nao perder os
  // ultimos 300 ms de edicao do debounce.
  const replaceBoard = useCallback((nextBoard, nextKey) => {
    const { board: currentBoard, boardKey: currentKey } = latest.current;
    if (nextKey && nextKey !== currentKey) storage.saveBoard(currentBoard, currentKey);
    if (nextKey) setBoardKey(nextKey);
    setBoard(nextBoard);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // `action` = { label, onClick }: botao no aviso (ex.: Desfazer), que fica mais tempo na tela.
  const showToast = useCallback((message, type = 'success', action = null) => {
    const id = generateId();
    setToasts(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => dismissToast(id), action ? 6000 : 3000);
  }, [dismissToast]);

  // Devolve ao quadro uma tarefa excluida, na mesma posicao (se a coluna ainda existir).
  const restoreTask = useCallback((task, columnId, index) => {
    setBoard(prev => {
      if (prev.columns.some(c => c.tasks.some(t => t.id === task.id))) return prev;
      const targetId = prev.columns.some(c => c.id === columnId) ? columnId : prev.columns[0]?.id;
      return {
        ...prev,
        columns: prev.columns.map(c => {
          if (c.id !== targetId) return c;
          const tasks = [...c.tasks];
          tasks.splice(Math.min(index, tasks.length), 0, { ...task, columnId: targetId });
          return { ...c, tasks };
        }),
      };
    });
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
    const column = latest.current.board.columns.find(c => c.tasks.some(t => t.id === taskId));
    if (!column) return;
    const index = column.tasks.findIndex(t => t.id === taskId);
    const removed = column.tasks[index];
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.filter(t => t.id !== taskId),
      })),
    }));
    showToast('Tarefa excluida', 'info', { label: 'Desfazer', onClick: () => restoreTask(removed, column.id, index) });
  }, [showToast, restoreTask]);

  // Exclui todas as tarefas concluidas de uma coluna (com desfazer).
  const clearCompleted = useCallback((columnId) => {
    const column = latest.current.board.columns.find(c => c.id === columnId);
    const done = (column?.tasks || []).map((t, index) => ({ t, index })).filter(({ t }) => t.completed);
    if (done.length === 0) {
      showToast('Nenhuma tarefa concluida nesta categoria', 'info');
      return;
    }
    const ids = new Set(done.map(({ t }) => t.id));
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => (c.id === columnId ? { ...c, tasks: c.tasks.filter(t => !ids.has(t.id)) } : c)),
    }));
    showToast(`${done.length} concluida${done.length > 1 ? 's' : ''} excluida${done.length > 1 ? 's' : ''}`, 'info', {
      label: 'Desfazer',
      onClick: () => done.forEach(({ t, index }) => restoreTask(t, columnId, index)),
    });
  }, [showToast, restoreTask]);

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
    const parent = latest.current.board.columns.flatMap(c => c.tasks).find(t => t.id === taskId);
    const index = (parent?.subtasks || []).findIndex(s => s.id === subtaskId);
    if (index < 0) return;
    const removed = parent.subtasks[index];
    setBoard(prev => ({
      ...prev,
      columns: prev.columns.map(c => ({
        ...c,
        tasks: c.tasks.map(t =>
          t.id === taskId ? { ...t, subtasks: t.subtasks.filter(s => s.id !== subtaskId) } : t
        ),
      })),
    }));
    showToast('Subtarefa excluida', 'info', {
      label: 'Desfazer',
      onClick: () => setBoard(prev => ({
        ...prev,
        columns: prev.columns.map(c => ({
          ...c,
          tasks: c.tasks.map(t => {
            if (t.id !== taskId || (t.subtasks || []).some(s => s.id === subtaskId)) return t;
            const subtasks = [...(t.subtasks || [])];
            subtasks.splice(Math.min(index, subtasks.length), 0, removed);
            return { ...t, subtasks };
          }),
        })),
      })),
    });
  }, [showToast]);

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
    addTask, updateTask, deleteTask, toggleTaskComplete, clearCompleted, dismissToast,
    addSubtask, toggleSubtask, deleteSubtask,
    convertSubtaskToTask, moveSubtaskToTask,
    moveTask, reorderTask, reorderColumns,
    getAllTasks, findTask, showToast,
    setBoard, replaceBoard, boardKey,
  };
}
