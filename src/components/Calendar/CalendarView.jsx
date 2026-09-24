import React, { useMemo, useState } from 'react';
import {
  addMonths,
  formatMonthYear,
  getCalendarDays,
  getWeekDays,
  isOverdue,
  isSameDay,
  isSameMonth,
  isToday,
  subMonths,
} from '../../utils/dateUtils';
import CalendarOverviewPanel from './CalendarOverviewPanel';

function getEventDate(item) {
  return item.eventType === 'google' ? (item.start || null) : (item.dueDate || null);
}

export default function CalendarView({ tasks, googleEvents, onTaskClick, onDateClick }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const days = useMemo(() => getCalendarDays(currentDate), [currentDate]);
  const weekDays = useMemo(() => getWeekDays(), []);

  const calendarItems = useMemo(() => {
    const taskItems = tasks
      .filter(task => !!task.dueDate)
      .map(task => ({ ...task, eventType: 'task' }));

    const googleItems = googleEvents.map(event => ({ ...event, eventType: 'google' }));

    return [...taskItems, ...googleItems].sort((left, right) => new Date(getEventDate(left)) - new Date(getEventDate(right)));
  }, [googleEvents, tasks]);

  const itemsByDate = useMemo(() => {
    const map = {};
    calendarItems.forEach(item => {
      const key = getEventDate(item)?.slice(0, 10);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });
    return map;
  }, [calendarItems]);

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const handleDaySelect = (day) => {
    setSelectedDate(day);
    setCurrentDate(day);
  };

  return (
    <div className="calendar-shell">
      <div className="calendar-container">
        <div className="calendar-header">
          <div className="calendar-nav">
            <button className="calendar-nav-btn" onClick={() => setCurrentDate(date => subMonths(date, 1))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="calendar-month-title">{formatMonthYear(currentDate).replace(/^\w/, char => char.toUpperCase())}</span>
            <button className="calendar-nav-btn" onClick={() => setCurrentDate(date => addMonths(date, 1))}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
          <div className="calendar-actions">
            <button className="calendar-today-btn" onClick={goToToday}>Hoje</button>
            <button className="btn btn-primary" onClick={() => onDateClick?.(selectedDate)}>Agendar nesta data</button>
          </div>
        </div>

        <div className="calendar-grid">
          {weekDays.map(day => (
            <div key={day} className="calendar-weekday">{day}</div>
          ))}
          {days.map(day => {
            const key = day.toISOString().slice(0, 10);
            const items = itemsByDate[key] || [];
            const sameMonth = isSameMonth(day, currentDate);
            const today = isToday(day);
            const selected = selectedDate ? isSameDay(day, selectedDate) : false;

            return (
              <div
                key={key}
                className={`calendar-day ${today ? 'today' : ''} ${selected ? 'selected' : ''} ${!sameMonth ? 'other-month' : ''}`}
                onClick={() => handleDaySelect(day)}
                onDoubleClick={() => onDateClick?.(day)}
              >
                <div className="calendar-day-number">
                  {today ? <span>{day.getDate()}</span> : day.getDate()}
                </div>
                <div className="calendar-day-events">
                  {items.slice(0, 4).map(item => {
                    const overdue = item.eventType === 'task' && isOverdue(item.dueDate) && !item.completed;

                    return (
                      <div
                        key={`${item.eventType}-${item.id || item.googleId}`}
                        className={`calendar-event-badge ${item.eventType === 'google' ? 'google' : overdue ? 'overdue' : 'task'}`}
                        onClick={event => {
                          event.stopPropagation();
                          if (item.eventType === 'task') onTaskClick?.(item);
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                    );
                  })}
                  {items.length > 4 && (
                    <div className="calendar-event-badge task" style={{ opacity: 0.6 }}>
                      +{items.length - 4} mais
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <CalendarOverviewPanel
        items={calendarItems}
        selectedDate={selectedDate}
        onDateSelect={handleDaySelect}
        onItemClick={item => {
          if (item.eventType === 'task') onTaskClick?.(item);
        }}
        onCreateRequested={onDateClick}
        title="Resumo"
      />
    </div>
  );
}
