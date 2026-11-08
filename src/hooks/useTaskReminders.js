import { useCallback, useEffect, useRef, useState } from 'react';
import { combineDateTime } from '../utils/dateUtils';
import { STORAGE_PREFIX } from '../config/variant';

const FIRED_KEY = `${STORAGE_PREFIX}-reminders-fired`;
const supported = typeof window !== 'undefined' && 'Notification' in window;

function loadFired() {
  try {
    return new Set(JSON.parse(localStorage.getItem(FIRED_KEY) || '[]'));
  } catch {
    return new Set();
  }
}

function saveFired(set) {
  try {
    localStorage.setItem(FIRED_KEY, JSON.stringify([...set].slice(-500)));
  } catch {
    // sem armazenamento: o pior caso e repetir um lembrete
  }
}

// No iPhone (PWA instalado) `new Notification()` nao existe; o caminho
// suportado e pelo service worker.
async function show(title, options) {
  try {
    const registration = await navigator.serviceWorker?.getRegistration?.();
    if (registration?.showNotification) {
      await registration.showNotification(title, { icon: './icons/icon-192.png', ...options });
      return;
    }
  } catch {
    // cai para a API direta
  }
  try {
    new Notification(title, options);
  } catch (error) {
    console.warn('Notificacao nao suportada neste navegador:', error);
  }
}

export function useTaskReminders(tasks) {
  const [permission, setPermission] = useState(supported ? Notification.permission : 'unsupported');
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const firedRef = useRef(null);

  // Precisa ser chamado a partir de um toque do usuario (exigencia do iOS).
  const requestPermission = useCallback(async () => {
    if (!supported) return 'unsupported';
    const result = await Notification.requestPermission();
    setPermission(result);
    return result;
  }, []);

  useEffect(() => {
    if (permission !== 'granted') return undefined;
    firedRef.current ||= loadFired();

    const check = () => {
      const now = Date.now();
      let changed = false;
      for (const task of tasksRef.current) {
        if (task.completed || !task.dueDate) continue;
        const eventDate = combineDateTime(task.dueDate, task.dueTime);
        if (!eventDate) continue;
        const minutes = Number(task.reminderMinutes ?? 30);
        const reminderAt = eventDate.getTime() - minutes * 60 * 1000;
        const key = `${task.id}|${task.dueDate}|${task.dueTime}|${minutes}`;
        // Dispara se o app abrir atrasado, ate o horario do compromisso.
        if (now >= reminderAt && now <= eventDate.getTime() && !firedRef.current.has(key)) {
          firedRef.current.add(key);
          changed = true;
          show(task.title, {
            body: task.subtitle || task.description || `Comeca ${task.dueTime ? `as ${task.dueTime}` : 'em breve'}`,
            tag: key,
          });
        }
      }
      if (changed) saveFired(firedRef.current);
    };

    check();
    const interval = setInterval(check, 30 * 1000);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [permission]);

  return { permission, requestPermission, supported };
}
