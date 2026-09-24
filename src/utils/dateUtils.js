import {
  format, isToday, isBefore, startOfDay, addDays, differenceInDays,
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, addMonths, subMonths
} from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const formatDate = (date, fmt = 'dd/MM/yyyy') =>
  format(new Date(date), fmt, { locale: ptBR });

export const formatTime = (date, fmt = 'HH:mm') =>
  format(new Date(date), fmt, { locale: ptBR });

export const formatDateFull = (date) =>
  format(new Date(date), "d 'de' MMMM 'de' yyyy", { locale: ptBR });

export const formatMonthYear = (date) =>
  format(new Date(date), "MMMM 'de' yyyy", { locale: ptBR });

export const isOverdue = (dateStr) => {
  if (!dateStr) return false;
  return isBefore(startOfDay(new Date(dateStr)), startOfDay(new Date()));
};

export const isDueToday = (dateStr) => {
  if (!dateStr) return false;
  return isToday(new Date(dateStr));
};

export const isDueSoon = (dateStr) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const diff = differenceInDays(startOfDay(d), startOfDay(new Date()));
  return diff >= 0 && diff <= 2;
};

export const combineDateTime = (dateStr, timeStr = '') => {
  if (!dateStr) return null;
  const safeTime = timeStr || '09:00';
  return new Date(`${dateStr.slice(0, 10)}T${safeTime}:00`);
};

export const formatTaskSchedule = (task) => {
  if (!task?.dueDate) return '';
  const base = formatDate(task.dueDate);
  if (!task.dueTime) return base;
  return `${base} as ${task.dueTime}`;
};

export const getCalendarDays = (date) => {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calStart = startOfWeek(monthStart, { locale: ptBR });
  const calEnd = endOfWeek(monthEnd, { locale: ptBR });
  return eachDayOfInterval({ start: calStart, end: calEnd });
};

export const getWeekDays = () => {
  const base = startOfWeek(new Date(), { locale: ptBR });
  return Array.from({ length: 7 }, (_, i) =>
    format(addDays(base, i), 'EEE', { locale: ptBR })
  );
};

export { isSameMonth, isSameDay, addMonths, subMonths, isToday, format };
