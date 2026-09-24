import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudSync, DEFAULT_SYNC_FILE } from '../services/cloudSync';
import { storage } from '../services/storage';
import { generateId } from '../utils/idGenerator';

const DEFAULT_CONFIG = {
  enabled: false,
  token: '',
  gistId: '',
  fileName: DEFAULT_SYNC_FILE,
  lastSyncedAt: '',
  lastError: '',
};

function readConfig() {
  const settings = storage.loadSettings() || {};
  return { ...DEFAULT_CONFIG, ...(settings.cloudSync || {}) };
}

function readDeviceId() {
  const settings = storage.loadSettings() || {};
  if (settings.deviceId) return settings.deviceId;
  const deviceId = generateId();
  storage.saveSettings({ ...settings, deviceId });
  return deviceId;
}

function saveConfig(nextConfig) {
  const settings = storage.loadSettings() || {};
  storage.saveSettings({ ...settings, cloudSync: nextConfig });
}

function getPayloadTimestamp(payload) {
  const time = Date.parse(payload?.updatedAt || '');
  return Number.isFinite(time) ? time : 0;
}

export function useCloudSync({ board, setBoard, showToast }) {
  const [config, setConfig] = useState(readConfig);
  const [status, setStatus] = useState({ state: 'idle', message: 'Cloud desligado' });
  const boardRef = useRef(board);
  const configRef = useRef(config);
  const deviceIdRef = useRef(readDeviceId());
  const dirtyRef = useRef(false);
  const applyingRemoteRef = useRef(false);
  const mountedRef = useRef(false);
  const syncTimerRef = useRef(null);
  const inFlightRef = useRef(false);

  const persistConfig = useCallback((updates) => {
    const next = { ...configRef.current, ...updates };
    configRef.current = next;
    setConfig(next);
    saveConfig(next);
    return next;
  }, []);

  const applyRemote = useCallback((payload, message = 'Quadro atualizado pela nuvem') => {
    if (!payload?.board) return;
    applyingRemoteRef.current = true;
    dirtyRef.current = false;
    setBoard(payload.board);
    persistConfig({
      lastSyncedAt: payload.updatedAt || new Date().toISOString(),
      lastError: '',
    });
    setStatus({ state: 'synced', message });
    showToast?.(message);
  }, [persistConfig, setBoard, showToast]);

  const upload = useCallback(async (currentConfig = configRef.current, message = 'Quadro enviado para a nuvem') => {
    const fileName = currentConfig.fileName || DEFAULT_SYNC_FILE;
    const args = {
      token: currentConfig.token,
      gistId: currentConfig.gistId,
      fileName,
      board: boardRef.current,
      deviceId: deviceIdRef.current,
    };

    const result = currentConfig.gistId
      ? await cloudSync.updateBoard(args)
      : await cloudSync.createBoard(args);

    const updatedConfig = persistConfig({
      enabled: true,
      gistId: result.gistId,
      fileName,
      lastSyncedAt: result.payload?.updatedAt || new Date().toISOString(),
      lastError: '',
    });
    dirtyRef.current = false;
    setStatus({ state: 'synced', message });
    showToast?.(message);
    return updatedConfig;
  }, [persistConfig, showToast]);

  const syncNow = useCallback(async (mode = 'smart', configOverride = null) => {
    const currentConfig = { ...configRef.current, ...(configOverride || {}) };
    if (!currentConfig.enabled || !currentConfig.token) return null;
    if (inFlightRef.current) return null;

    inFlightRef.current = true;
    setStatus({ state: 'syncing', message: 'Sincronizando...' });
    try {
      if (!currentConfig.gistId) {
        return await upload(currentConfig);
      }

      const remote = await cloudSync.readBoard({
        token: currentConfig.token,
        gistId: currentConfig.gistId,
        fileName: currentConfig.fileName || DEFAULT_SYNC_FILE,
      });

      if (!remote?.payload?.board) {
        return await upload(currentConfig);
      }

      if (mode === 'pull') {
        applyRemote(remote.payload);
        return configRef.current;
      }

      if (mode === 'push') {
        return await upload(currentConfig);
      }

      const remoteTime = getPayloadTimestamp(remote.payload);
      const lastSyncedTime = getPayloadTimestamp({ updatedAt: currentConfig.lastSyncedAt });

      if (remoteTime > lastSyncedTime) {
        if (dirtyRef.current) {
          const message = 'Conflito: ha mudancas locais e remotas. Escolha baixar ou enviar.';
          setStatus({ state: 'conflict', message });
          persistConfig({ lastError: message });
          showToast?.(message, 'error');
          return configRef.current;
        }

        applyRemote(remote.payload);
        return configRef.current;
      }

      if (dirtyRef.current) {
        return await upload(currentConfig);
      }

      setStatus({ state: 'synced', message: 'Cloud sincronizado' });
      return currentConfig;
    } catch (error) {
      const message = error?.message || 'Falha ao sincronizar';
      setStatus({ state: 'error', message });
      persistConfig({ lastError: message });
      showToast?.(message, 'error');
      return null;
    } finally {
      inFlightRef.current = false;
    }
  }, [applyRemote, persistConfig, showToast, upload]);

  const updateConfig = useCallback(async (updates, syncAfterSave = true) => {
    const next = persistConfig(updates);
    if (syncAfterSave && next.enabled && next.token) {
      await syncNow('smart', next);
    }
    return next;
  }, [persistConfig, syncNow]);

  useEffect(() => {
    boardRef.current = board;
    if (!mountedRef.current) {
      mountedRef.current = true;
      return;
    }
    if (applyingRemoteRef.current) {
      applyingRemoteRef.current = false;
      return;
    }
    dirtyRef.current = true;

    if (!configRef.current.enabled || !configRef.current.token) return;
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      syncNow('smart');
    }, 1800);

    return () => {
      if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    };
  }, [board, syncNow]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    if (!config.enabled || !config.token) {
      setStatus({ state: 'idle', message: 'Cloud desligado' });
      return undefined;
    }

    syncNow('smart');
    const interval = setInterval(() => syncNow('smart'), 90 * 1000);
    return () => clearInterval(interval);
  }, [config.enabled, config.gistId, config.token, config.fileName, syncNow]);

  return {
    config,
    status,
    updateConfig,
    syncNow,
  };
}
