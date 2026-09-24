import { useState, useEffect, useCallback, useRef } from 'react';
import { googleCalendar } from '../services/googleCalendar';
import { storage } from '../services/storage';

export function useGoogleCalendar() {
  const [isConnected, setIsConnected] = useState(false);
  const [googleEvents, setGoogleEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [clientId, setClientId] = useState(() => {
    const settings = storage.loadSettings();
    return settings?.googleClientId || '';
  });
  const intervalRef = useRef(null);

  useEffect(() => {
    if (clientId) {
      googleCalendar.onSignInChange = (signedIn) => {
        setIsConnected(signedIn);
        if (signedIn) fetchEvents();
      };
      googleCalendar.init(clientId);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [clientId]);

  useEffect(() => {
    if (isConnected) {
      fetchEvents();
      intervalRef.current = setInterval(fetchEvents, 5 * 60 * 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setGoogleEvents([]);
    }
  }, [isConnected]);

  const fetchEvents = useCallback(async () => {
    if (!googleCalendar.isSignedIn) return;
    setIsLoading(true);
    try {
      const events = await googleCalendar.listEvents();
      setGoogleEvents(events);
    } catch (e) {
      console.error('Erro ao buscar eventos:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signIn = useCallback(() => {
    if (!clientId) return;
    googleCalendar.signIn();
  }, [clientId]);

  const signOut = useCallback(() => {
    googleCalendar.signOut();
    setIsConnected(false);
    setGoogleEvents([]);
  }, []);

  const updateClientId = useCallback((id) => {
    setClientId(id);
    const settings = storage.loadSettings() || {};
    storage.saveSettings({ ...settings, googleClientId: id });
  }, []);

  const syncTask = useCallback(async (task) => {
    if (!isConnected || !task.dueDate) return null;
    if (task.googleEventId) {
      await googleCalendar.updateEvent(task.googleEventId, task);
      return task.googleEventId;
    } else {
      return await googleCalendar.createEvent(task);
    }
  }, [isConnected]);

  const unsyncTask = useCallback(async (googleEventId) => {
    if (!isConnected || !googleEventId) return;
    await googleCalendar.deleteEvent(googleEventId);
  }, [isConnected]);

  return {
    isConnected, googleEvents, isLoading, clientId,
    signIn, signOut, updateClientId, syncTask, unsyncTask, fetchEvents,
  };
}
