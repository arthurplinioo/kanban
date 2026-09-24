import React, { useMemo, useState } from 'react';
import { addMonths, format, formatDateFull, formatMonthYear, formatTaskSchedule, getCalendarDays, getWeekDays, isSameDay, isSameMonth, isToday, subMonths } from '../../utils/dateUtils';

function getItemDate(item) {
  return item.eventType === 'google' ? (item.start || null) : (item.dueDate || null);
}

export default function CalendarOverviewPanel({
  items,
  selectedDate,
  onDateSelect,
  onItemClick,
  onCreateRequested,
  title = 'Agenda',
  compact = false,
}) {
  const [currentDate, setCurrentDate] = useState(selectedDate || new Date());
  const days = useMemo(() => getCalendarDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(), []);

  const normalizedItems = useMemo(() => {
    return [...items]
      .filter(item => !!getItemDate(item))
      .sort((left, right) => new Date(getItemDate(left)) - new Date(getItemDate(right)));
  }, [items]);

  const selectedItems = useMemo(() => {
    if (!selectedDate) return [];
    return normalizedItems.filter(item => isSameDay(new Date(getItemDate(item)), selectedDate));
  }, [normalizedItems, selectedDate]);

  const upcomingItems = useMemo(() => normalizedItems.slice(0, compact ? 5 : 8), [compact, normalizedItems]);

  return (
    <aside className={`calendar-overview ${compact ? 'compact' : ''}`}>
      <div className="calendar-overview-header">
        <div>
          <p className="calendar-overview-eyebrow">{title}</p>
          <h3 className="calendar-overview-title">{formatMonthYear(currentDate).replace(/^\w/, char => char.toUpperCase())}</h3>
        </div>
        <div className="calendar-overview-nav">
          <button className="calendar-nav-btn" onClick={() => setCurrentDate(value => subMonths(value, 1))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button className="calendar-nav-btn" onClick={() => setCurrentDate(value => addMonths(value, 1))}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="calendar-mini-grid">
        {weekDays.map(day => (
          <span key={day} className="calendar-mini-weekday">{day.slice(0, 1)}</span>
        ))}
        {days.map(day => {
          const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
          const hasItems = normalizedItems.some(item => isSameDay(new Date(getItemDate(item)), day));

          return (
            <button
              key={day.toISOString()}
              className={`calendar-mini-day ${isToday(day) ? 'today' : ''} ${isSelected ? 'selected' : ''} ${!isSameMonth(day, currentDate) ? 'other-month' : ''}`}
              onClick={() => onDateSelect?.(day)}
            >
              <span>{day.getDate()}</span>
              {hasItems && <i className="calendar-mini-dot" />}
            </button>
          );
        })}
      </div>

      {!compact && selectedDate && (
        <div className="calendar-overview-section">
          <div className="calendar-overview-section-header">
            <h4>{formatDateFull(selectedDate)}</h4>
            <button className="btn btn-sm btn-primary" onClick={() => onCreateRequested?.(selectedDate)}>
              Novo item
            </button>
          </div>
          <div className="calendar-overview-list">
            {selectedItems.length === 0 && <p className="calendar-overview-empty">Nenhum compromisso para esta data.</p>}
            {selectedItems.map(item => (
              (() => {
                const itemDate = getItemDate(item);
                return (
                  <button
                    key={`${item.eventType}-${item.id || item.googleId}`}
                    className="calendar-overview-item"
                    onClick={() => onItemClick?.(item)}
                  >
                    <span className={`calendar-overview-item-type ${item.eventType === 'google' ? 'google' : 'task'}`}>
                      {item.eventType === 'google' ? 'Google' : 'Tarefa'}
                    </span>
                    <strong>{item.title}</strong>
                    <p>{item.eventType === 'task' ? formatTaskSchedule(item) : format(new Date(itemDate || item.start), 'dd/MM HH:mm')}</p>
                    <p>{item.description || item.subtitle || 'Sem descricao'}</p>
                  </button>
                );
              })()
            ))}
          </div>
        </div>
      )}

      <div className="calendar-overview-section">
        <div className="calendar-overview-section-header">
          <h4>{compact ? 'Proximos itens' : 'Linha do tempo'}</h4>
        </div>
        <div className="calendar-overview-list">
          {upcomingItems.length === 0 && <p className="calendar-overview-empty">Sem itens marcados ainda.</p>}
          {upcomingItems.map(item => {
            const itemDate = getItemDate(item);
            return (
              <button
                key={`timeline-${item.eventType}-${item.id || item.googleId}`}
                className="calendar-overview-item"
                onClick={() => {
                  if (itemDate) onDateSelect?.(new Date(itemDate));
                  onItemClick?.(item);
                }}
              >
                <span className={`calendar-overview-item-type ${item.eventType === 'google' ? 'google' : 'task'}`}>
                  {format(new Date(itemDate), 'dd/MM')}
                </span>
                <strong>{item.title}</strong>
                <p>{item.eventType === 'task' ? formatTaskSchedule(item) : format(new Date(itemDate), 'dd/MM HH:mm')}</p>
                <p>{item.description || item.subtitle || 'Sem descricao'}</p>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
