import { useEffect, useRef } from 'react';
import { combineDateTime } from '../utils/dateUtils';

export function useTaskReminders(tasks, isEnabled = true) {
  const firedRef = useRef(new Set());

  useEffect(() => {
    if (!isEnabled || typeof window === 'undefined' || !('Notification' in window)) return undefined;

    const maybeNotify = async () => {
      if (Notification.permission === 'default') {
        await Notification.requestPermission();
      }

      if (Notification.permission !== 'granted') return;

      const now = Date.now();
      tasks.forEach(task => {
        if (task.completed || !task.dueDate) return;

        const eventDate = combineDateTime(task.dueDate, task.dueTime);
        if (!eventDate) return;

        const reminderMinutes = Number(task.reminderMinutes ?? 30);
        const reminderAt = eventDate.getTime() - reminderMinutes * 60 * 1000;
        const reminderKey = `${task.id}-${task.dueDate}-${task.dueTime}-${reminderMinutes}`;

        if (now >= reminderAt && now <= reminderAt + 60 * 1000 && !firedRef.current.has(reminderKey)) {
          firedRef.current.add(reminderKey);
          new Notification(task.title, {
            body: task.subtitle || task.description || `Comeca em ${task.dueTime || 'breve'}`,
            tag: reminderKey,
          });
        }
      });
    };

    maybeNotify();
    const interval = window.setInterval(maybeNotify, 60 * 1000);
    return () => window.clearInterval(interval);
  }, [isEnabled, tasks]);
}
