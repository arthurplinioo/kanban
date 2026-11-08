import { STORAGE_PREFIX } from '../config/variant';

const BOARD_KEY = `${STORAGE_PREFIX}-data`;
const SETTINGS_KEY = `${STORAGE_PREFIX}-settings`;
const SYNC_KEY_PREFIX = `${STORAGE_PREFIX}-sync-`;

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Depois de sair da conta nada mais e gravado ate a pagina recarregar.
let locked = false;

function write(key, value) {
  if (locked) return;
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    console.error('Erro ao salvar dados locais:', e);
  }
}

export const storage = {
  saveBoard(data, boardKey = 'personal') {
    write(boardKey === 'personal' ? BOARD_KEY : `${BOARD_KEY}-${boardKey}`, data);
  },

  loadBoard(boardKey = 'personal') {
    return read(boardKey === 'personal' ? BOARD_KEY : `${BOARD_KEY}-${boardKey}`);
  },

  saveSettings(settings) {
    write(SETTINGS_KEY, settings);
  },

  loadSettings() {
    return read(SETTINGS_KEY);
  },

  updateSettings(updates) {
    const next = { ...(read(SETTINGS_KEY) || {}), ...updates };
    write(SETTINGS_KEY, next);
    return next;
  },

  // Estado de sincronizacao por quadro: ultima versao conhecida do servidor
  // (base do merge) e se ha edicoes locais ainda nao enviadas. Persistido para
  // que edicoes feitas offline sobrevivam a um fechamento do app.
  loadSyncState(boardId) {
    return read(SYNC_KEY_PREFIX + boardId);
  },

  saveSyncState(boardId, state) {
    write(SYNC_KEY_PREFIX + boardId, state);
  },

  // Inclui o quadro pessoal: ele esta salvo na nuvem, e deixa-lo no aparelho
  // faria o proximo usuario que entrar aqui herdar (e mesclar) estas tarefas.
  clearAllForSignOut() {
    locked = true;
    try {
      Object.keys(localStorage)
        .filter(key => key === BOARD_KEY || key.startsWith(SYNC_KEY_PREFIX) || key.startsWith(`${BOARD_KEY}-`)
          || key.startsWith(`${STORAGE_PREFIX}-gcal-`) || key.startsWith(`${STORAGE_PREFIX}-reminders-`))
        .forEach(key => localStorage.removeItem(key));
    } catch {
      // armazenamento indisponivel (modo privado): nada a limpar
    }
  },

  exportData() {
    const data = this.loadBoard();
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `taskflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  },
};
