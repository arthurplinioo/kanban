import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './App.css';
import './theme.css';
import Header from './components/Layout/Header';
import MobileNavBar from './components/Layout/MobileNavBar';
import KanbanBoard from './components/Board/KanbanBoard';
import CalendarView from './components/Calendar/CalendarView';
import CalendarOverviewPanel from './components/Calendar/CalendarOverviewPanel';
import GoogleConfigModal from './components/GoogleAuth/GoogleConfigModal';
import TaskDetailModal from './components/Board/TaskDetailModal';
import BoardSwitcher from './components/Boards/BoardSwitcher';
import NewBoardModal from './components/Boards/NewBoardModal';
import ShareBoardModal from './components/Boards/ShareBoardModal';
import { useBoard } from './hooks/useBoard';
import { useGoogleCalendar } from './hooks/useGoogleCalendar';
import { useDriveSync } from './hooks/useDriveSync';
import { useCloudBoards } from './hooks/useCloudBoards';
import { useTaskReminders } from './hooks/useTaskReminders';
import { storage } from './services/storage';
import { firebaseEnabled } from './services/firebase';
import { DEFAULT_THEME } from './config/variant';

function App() {
  const [activeView, setActiveView] = useState('board');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGoogleConfig, setShowGoogleConfig] = useState(false);
  const [showNewBoard, setShowNewBoard] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [calendarModalState, setCalendarModalState] = useState(null);
  const [theme, setTheme] = useState(() => storage.loadSettings()?.theme || DEFAULT_THEME);

  const boardHook = useBoard();
  const googleHook = useGoogleCalendar();
  const cloud = useCloudBoards({
    board: boardHook.board,
    boardKey: boardHook.boardKey,
    replaceBoard: boardHook.replaceBoard,
    showToast: boardHook.showToast,
  });
  // Sem Firebase configurado, o quadro pessoal continua sincronizando pelo
  // Google Drive como antes.
  const driveSyncStatus = useDriveSync(
    boardHook.board,
    boardHook.setBoard,
    !firebaseEnabled && googleHook.isConnected,
    boardHook.showToast,
  );
  // Agenda so no quadro pessoal: o evento fica na agenda de quem criou.
  const calendarActive = googleHook.isConnected && cloud.isPersonal;

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    storage.updateSettings({ theme });
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  }, []);

  const handleSyncGoogle = useCallback(async (task) => {
    if (!calendarActive || !task?.dueDate) return null;
    const googleId = await googleHook.syncTask(task);
    if (googleId) {
      boardHook.updateTask(task.id, { googleEventId: googleId, syncWithGoogle: true });
      googleHook.fetchEvents();
      boardHook.showToast('Sincronizado com Google Agenda');
    }
    return googleId;
  }, [calendarActive, googleHook, boardHook]);

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
    } else {
      boardHook.updateTask(taskId, persistedTask);
    }

    if (!calendarActive) return mergedTask;
    if (mergedTask.syncWithGoogle && mergedTask.dueDate) {
      await handleSyncGoogle(mergedTask);
    } else if (currentTask.googleEventId && (!mergedTask.syncWithGoogle || !mergedTask.dueDate)) {
      await googleHook.unsyncTask(currentTask.googleEventId);
      googleHook.fetchEvents();
      boardHook.updateTask(taskId, { googleEventId: null, syncWithGoogle: false });
    }
    return mergedTask;
  }, [boardHook, googleHook, handleSyncGoogle, calendarActive]);

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
        syncWithGoogle: calendarActive,
        columnId: boardHook.board.columns[0]?.id || '',
      }
    });
  }, [boardHook.board.columns, calendarActive]);

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

  const allTasks = useMemo(() => boardHook.getAllTasks(), [boardHook.board]); // eslint-disable-line react-hooks/exhaustive-deps
  const reminders = useTaskReminders(allTasks);

  const handleRemindersClick = useCallback(async () => {
    if (!reminders.supported) {
      boardHook.showToast('No iPhone, adicione o app a Tela de Inicio para receber lembretes.', 'info');
      return;
    }
    if (reminders.permission === 'granted') {
      boardHook.showToast('Lembretes ativos enquanto o app estiver aberto ou em segundo plano.', 'info');
      return;
    }
    const result = await reminders.requestPermission();
    boardHook.showToast(result === 'granted' ? 'Lembretes ativados' : 'Permissao de notificacao negada nas configuracoes', result === 'granted' ? 'success' : 'error');
  }, [reminders, boardHook]);

  const calendarItems = useMemo(() => {
    const taskItems = allTasks
      .filter(task => !!task.dueDate)
      .map(task => ({ ...task, eventType: 'task' }));
    const googleItems = calendarActive ? googleHook.googleEvents.map(event => ({ ...event, eventType: 'google' })) : [];
    return [...taskItems, ...googleItems];
  }, [allTasks, googleHook.googleEvents, calendarActive]);

  const currentBoardTitle = cloud.isPersonal ? 'Meu Quadro' : boardHook.board.title;

  const boardSwitcher = cloud.user ? (
    <BoardSwitcher
      boards={cloud.boards}
      activeBoardId={cloud.activeBoardId}
      currentTitle={currentBoardTitle}
      onSelect={(id) => { cloud.selectBoard(id); setActiveView('board'); }}
      onCreate={() => setShowNewBoard(true)}
      onShare={() => setShowShare(true)}
      canShare={!cloud.isPersonal && Boolean(cloud.activeMeta)}
    />
  ) : null;

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
          showCalendarButton={cloud.isPersonal}
          cloud={cloud}
          boardSwitcher={boardSwitcher}
          onRemindersClick={handleRemindersClick}
          remindersEnabled={reminders.permission === 'granted'}
        />

        {cloud.enabled && cloud.authReady && !cloud.user && (
          <div className="signin-banner">
            <span>Entre com sua conta Google para sincronizar PC e iPhone e usar quadros compartilhados.</span>
            <button className="btn btn-primary btn-sm" onClick={cloud.signIn}>Entrar com Google</button>
          </div>
        )}

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
                isGoogleConnected={calendarActive}
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
              googleEvents={calendarActive ? googleHook.googleEvents : []}
              onTaskClick={handleCalendarTaskClick}
              onDateClick={handleDateClick}
            />
          )}
        </div>

        <MobileNavBar activeView={activeView} onViewChange={setActiveView} />
      </div>

      <GoogleConfigModal
        isOpen={showGoogleConfig}
        onClose={() => setShowGoogleConfig(false)}
        clientId={googleHook.clientId}
        onUpdateClientId={googleHook.updateClientId}
        isConnected={googleHook.isConnected}
        onSignIn={googleHook.signIn}
        onSignOut={googleHook.signOut}
        driveSyncStatus={firebaseEnabled ? 'idle' : driveSyncStatus}
      />

      <NewBoardModal
        isOpen={showNewBoard}
        onCreate={cloud.createBoard}
        onClose={(createdId) => { setShowNewBoard(false); if (createdId) setShowShare(true); }}
      />

      <ShareBoardModal
        isOpen={showShare}
        onClose={() => setShowShare(false)}
        meta={cloud.activeMeta}
        boardTitle={boardHook.board.title}
        myEmail={cloud.user?.email}
        onInvite={cloud.invite}
        onRemove={cloud.removePerson}
        onDelete={cloud.deleteBoard}
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
          isGoogleConnected={calendarActive}
          onSyncGoogle={handleSyncGoogle}
        />
      )}

      {boardHook.toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {boardHook.toasts.map(t => (
            <div key={t.id} className={`toast ${t.type}`}>{t.message}</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default App;
