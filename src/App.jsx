import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import Header from './components/Layout/Header';
import KanbanBoard from './components/Board/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import CalendarOverviewPanel from './components/Calendar/CalendarOverviewPanel';
import GoogleConfigModal from './components/GoogleAuth/GoogleConfigModal';
import CloudSyncModal from './components/CloudSync/CloudSyncModal';
import TaskDetailModal from './components/Board/TaskDetailModal';
import { useBoard } from './hooks/useBoard';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useCloudSync } from './hooks/useCloudSync';
import { useDriveSync } from './hooks/useDriveSync';
import { useTaskReminders } from './hooks/useTaskReminders';
import { storage } from './services/storage';

function App() {
  const [activeView, setActiveView] = useState('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const [showCloudSync, setShowCloudSync] = useState(false);
  const [calendarModalState, setCalendarModalState] = useState(null);
  const [theme, setTheme] = useState(() => {
    const settings = storage.loadSettings();
    return settings?.theme || 'dark';
  });

  const boardHook = useBoard();
  const googleHook = useGoogleCalendar();
  const cloudHook = useCloudSync({
    board: boardHook.board,
    setBoard: boardHook.setBoard,
    showToast: boardHook.showToast,
  });
  const driveSyncStatus = useDriveSync(
    boardHook.board,
    boardHook.setBoard,
    googleHook.isConnected,
    boardHook.showToast
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    const settings = storage.loadSettings() || {};
    storage.saveSettings({ ...settings, theme });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const handleSyncGoogle = useCallback(async (task) => {
    if (!googleHook.isConnected || !task?.dueDate) return null;
    const googleId = await googleHook.syncTask(task);
    if (googleId) {
      boardHook.updateTask(task.id, { googleEventId: googleId, syncWithGoogle: true });
      googleHook.fetchEvents();
      boardHook.showToast('Sincronizado com Google Agenda');
    }
    return googleId;
  }, [googleHook, boardHook]);

  const handlePersistTask = useCallback(async (taskId, updates) => {
    const currentTask = boardHook.findTask(taskId);
    if (!currentTask) return;

    const mergedTask = { ...currentTask, ...updates };
    const targetColumnId = updates.columnId || currentTask.columnId;
    const shouldMove = targetColumnId && targetColumnId !== currentTask.columnId;
    const { columnId: _discardedColumnId, columnTitle: _discardedColumnTitle, ...persistedTask } = mergedTask;

    if (shouldMove) {
      boardHook.setBoard(prev => ({
        ...prev,
        columns: prev.columns.map(column => {
          if (column.id === currentTask.columnId) {
            return { ...column, tasks: column.tasks.filter(task => task.id !== taskId) };
          }

          if (column.id === targetColumnId) {
            return { ...column, tasks: [...column.tasks, persistedTask] };
          }

          return column;
        })
      }));

      if (mergedTask.syncWithGoogle && mergedTask.dueDate) {
        await handleSyncGoogle(mergedTask);
      } else if (currentTask.googleEventId && (!mergedTask.syncWithGoogle || !mergedTask.dueDate)) {
        await googleHook.unsyncTask(currentTask.googleEventId);
        googleHook.fetchEvents();
        boardHook.updateTask(taskId, { googleEventId: null, syncWithGoogle: false });
      }
      return mergedTask;
    }

    boardHook.updateTask(taskId, persistedTask);
    if (mergedTask.syncWithGoogle && mergedTask.dueDate) {
      await handleSyncGoogle(mergedTask);
    } else if (currentTask.googleEventId && (!mergedTask.syncWithGoogle || !mergedTask.dueDate)) {
      await googleHook.unsyncTask(currentTask.googleEventId);
      googleHook.fetchEvents();
      boardHook.updateTask(taskId, { googleEventId: null, syncWithGoogle: false });
    }
    return mergedTask;
  }, [boardHook, googleHook, handleSyncGoogle]);

  const handleCreateTaskFromCalendar = useCallback(async (payload) => {
    const targetColumnId = payload.columnId || boardHook.board.columns[0]?.id;
    if (!targetColumnId) return;

    const createdTask = boardHook.addTask(targetColumnId, payload);
    if (payload.syncWithGoogle && payload.dueDate) {
      await handleSyncGoogle({ ...createdTask, ...payload });
    }
  }, [boardHook, handleSyncGoogle]);

  const handleDateClick = useCallback((date) => {
    setCalendarModalState({
      mode: 'create',
      task: {
        title: '',
        subtitle: '',
        description: '',
        priority: null,
        dueDate: date.toISOString(),
        dueTime: '09:00',
        endDate: date.toISOString(),
        endTime: '10:00',
        recurrence: 'none',
        reminderMinutes: 30,
        labels: [],
        subtasks: [],
        syncWithGoogle: googleHook.isConnected,
        columnId: boardHook.board.columns[0]?.id || '',
      }
    });
  }, [boardHook.board.columns, googleHook.isConnected]);

  const handleCalendarTaskClick = useCallback((task) => {
    setCalendarModalState({ mode: 'edit', task });
  }, []);

  const handleCalendarModalSave = useCallback(async (...args) => {
    if (!calendarModalState) return;

    if (calendarModalState.mode === 'create') {
      await handleCreateTaskFromCalendar(args[0]);
    } else {
      await handlePersistTask(args[0], args[1]);
    }
  }, [calendarModalState, handleCreateTaskFromCalendar, handlePersistTask]);

  const allTasks = boardHook.getAllTasks();
  useTaskReminders(allTasks, true);

  const calendarItems = useMemo(() => {
    const taskItems = allTasks
      .filter(task => !!task.dueDate)
      .map(task => ({ ...task, eventType: 'task' }));
    const googleItems = googleHook.googleEvents.map(event => ({ ...event, eventType: 'google' }));
    return [...taskItems, ...googleItems];
  }, [allTasks, googleHook.googleEvents]);

  return (
    <div className="app">
      <div className="app-main">
        <Header
          activeView={activeView}
          onViewChange={setActiveView}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          theme={theme}
          onToggleTheme={toggleTheme}
          isGoogleConnected={googleHook.isConnected}
          onGoogleClick={() => setShowGoogleConfig(true)}
          cloudSyncStatus={cloudHook.status}
          isCloudSyncEnabled={cloudHook.config.enabled}
          onCloudClick={() => setShowCloudSync(true)}
        />

        <div className="app-content">
          {activeView === 'board' ? (
            <div className="board-layout">
              <KanbanBoard
                board={boardHook.board}
                onUpdateBoardTitle={boardHook.updateBoardTitle}
                onAddColumn={boardHook.addColumn}
                onUpdateColumn={boardHook.updateColumn}
                onDeleteColumn={boardHook.deleteColumn}
                onAddTask={boardHook.addTask}
                onUpdateTask={handlePersistTask}
                onDeleteTask={boardHook.deleteTask}
                onToggleComplete={boardHook.toggleTaskComplete}
                onAddSubtask={boardHook.addSubtask}
                onToggleSubtask={boardHook.toggleSubtask}
                onDeleteSubtask={boardHook.deleteSubtask}
                onMoveTask={boardHook.moveTask}
                onReorderTask={boardHook.reorderTask}
                onReorderColumns={boardHook.reorderColumns}
                onConvertSubtaskToTask={boardHook.convertSubtaskToTask}
                onMoveSubtaskToTask={boardHook.moveSubtaskToTask}
                isGoogleConnected={googleHook.isConnected}
                onSyncGoogle={handleSyncGoogle}
                searchQuery={searchQuery}
              />
              <CalendarOverviewPanel
                items={calendarItems}
                selectedDate={new Date()}
                onDateSelect={handleDateClick}
                onItemClick={(item) => {
                  if (item.eventType === 'task') handleCalendarTaskClick(item);
                }}
                onCreateRequested={handleDateClick}
                compact
                title="Mini calendario"
              />
            </div>
          ) : (
            <CalendarView
              tasks={allTasks}
              googleEvents={googleHook.googleEvents}
              onTaskClick={handleCalendarTaskClick}
              onDateClick={handleDateClick}
            />
          )}
        </div>
      </div>

      <GoogleConfigModal
        isOpen={showGoogleConfig}
        onClose={() => setShowGoogleConfig(false)}
        clientId={googleHook.clientId}
        onUpdateClientId={googleHook.updateClientId}
        isConnected={googleHook.isConnected}
        onSignIn={googleHook.signIn}
        onSignOut={googleHook.signOut}
        driveSyncStatus={driveSyncStatus}
      />

      <CloudSyncModal
        isOpen={showCloudSync}
        onClose={() => setShowCloudSync(false)}
        config={cloudHook.config}
        status={cloudHook.status}
        onSave={cloudHook.updateConfig}
        onSyncNow={cloudHook.syncNow}
      />

      {calendarModalState && (
        <TaskDetailModal
          task={calendarModalState.task}
          isOpen={!!calendarModalState}
          isCreateMode={calendarModalState.mode === 'create'}
          columns={boardHook.board.columns}
          defaultColumnId={boardHook.board.columns[0]?.id}
          onClose={() => setCalendarModalState(null)}
          onUpdate={handleCalendarModalSave}
          onDelete={(id) => { boardHook.deleteTask(id); setCalendarModalState(null); }}
          onAddSubtask={boardHook.addSubtask}
          onToggleSubtask={boardHook.toggleSubtask}
          onDeleteSubtask={boardHook.deleteSubtask}
          isGoogleConnected={googleHook.isConnected}
          onSyncGoogle={handleSyncGoogle}
        />
      )}

      {/* Toasts */}
      {boardHook.toasts.length > 0 && (
        <div className="toast-container">
          {boardHook.toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
