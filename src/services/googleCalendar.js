const SCOPES = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/drive.appdata';
const DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';

let gapiInited = false;
let gisInited = false;
let tokenClient = null;

function buildDateTime(dateStr, timeStr = '') {
  if (!dateStr) return null;
  const safeTime = timeStr || '09:00';
  return new Date(`${dateStr.slice(0, 10)}T${safeTime}:00`);
}

function buildRecurrenceRule(recurrence) {
  if (recurrence === 'daily') return ['RRULE:FREQ=DAILY'];
  if (recurrence === 'weekly') return ['RRULE:FREQ=WEEKLY'];
  if (recurrence === 'monthly') return ['RRULE:FREQ=MONTHLY'];
  return undefined;
}

function buildGoogleEvent(task) {
  const start = buildDateTime(task.dueDate, task.dueTime) || new Date(task.dueDate);
  const explicitEnd = buildDateTime(task.endDate || task.dueDate, task.endTime || task.dueTime);
  const end = explicitEnd && explicitEnd > start ? explicitEnd : new Date(start.getTime() + 60 * 60 * 1000);

  return {
    summary: task.title,
    description: task.description || task.subtitle || '',
    start: {
      dateTime: start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    recurrence: buildRecurrenceRule(task.recurrence),
    reminders: task.reminderMinutes === null || task.reminderMinutes === undefined
      ? undefined
      : {
          useDefault: false,
          overrides: [{ method: 'popup', minutes: Number(task.reminderMinutes) || 0 }],
        },
  };
}

export const googleCalendar = {
  clientId: '',
  isSignedIn: false,
  onSignInChange: null,

  async init(clientId) {
    if (!clientId) return false;
    this.clientId = clientId;
    try {
      await this._loadGapi();
      await this._loadGis();
      return true;
    } catch (error) {
      console.error('Google Calendar init error:', error);
      return false;
    }
  },

  _loadGapi() {
    return new Promise((resolve, reject) => {
      if (window.gapi && gapiInited) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://apis.google.com/js/api.js';
      script.onload = () => {
        window.gapi.load('client', async () => {
          try {
            await window.gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
            gapiInited = true;
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  _loadGis() {
    return new Promise((resolve, reject) => {
      if (window.google && gisInited) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.onload = () => {
        try {
          tokenClient = window.google.accounts.oauth2.initTokenClient({
            client_id: this.clientId,
            scope: SCOPES,
            callback: (response) => {
              if (response.error) {
                console.error(response);
                return;
              }
              this.isSignedIn = true;
              this.onSignInChange?.(true);
            },
          });
          gisInited = true;
          resolve();
        } catch (error) {
          reject(error);
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  },

  signIn() {
    if (!tokenClient) return;
    if (window.gapi.client.getToken() === null) tokenClient.requestAccessToken({ prompt: 'consent' });
    else tokenClient.requestAccessToken({ prompt: '' });
  },

  signOut() {
    const token = window.gapi?.client?.getToken();
    if (token) {
      window.google.accounts.oauth2.revoke(token.access_token);
      window.gapi.client.setToken('');
    }
    this.isSignedIn = false;
    this.onSignInChange?.(false);
  },

  async listEvents(timeMin, timeMax) {
    if (!this.isSignedIn) return [];
    try {
      const response = await window.gapi.client.calendar.events.list({
        calendarId: 'primary',
        timeMin: timeMin || new Date().toISOString(),
        timeMax: timeMax || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
        showDeleted: false,
        singleEvents: true,
        maxResults: 250,
        orderBy: 'startTime',
      });

      return (response.result.items || []).map(event => ({
        id: event.id,
        googleId: event.id,
        title: event.summary || 'Sem titulo',
        description: event.description || '',
        start: event.start.dateTime || event.start.date,
        end: event.end.dateTime || event.end.date,
        recurrence: event.recurrence?.[0] || null,
        isGoogleEvent: true,
        color: event.colorId || null,
      }));
    } catch (error) {
      console.error('Erro ao listar eventos:', error);
      return [];
    }
  },

  async createEvent(task) {
    if (!this.isSignedIn) return null;
    try {
      const response = await window.gapi.client.calendar.events.insert({
        calendarId: 'primary',
        resource: buildGoogleEvent(task),
      });
      return response.result.id;
    } catch (error) {
      console.error('Erro ao criar evento:', error);
      return null;
    }
  },

  async updateEvent(googleEventId, task) {
    if (!this.isSignedIn || !googleEventId) return false;
    try {
      await window.gapi.client.calendar.events.update({
        calendarId: 'primary',
        eventId: googleEventId,
        resource: buildGoogleEvent(task),
      });
      return true;
    } catch (error) {
      console.error('Erro ao atualizar evento:', error);
      return false;
    }
  },

  async deleteEvent(googleEventId) {
    if (!this.isSignedIn || !googleEventId) return false;
    try {
      await window.gapi.client.calendar.events.delete({
        calendarId: 'primary',
        eventId: googleEventId,
      });
      return true;
    } catch (error) {
      console.error('Erro ao deletar evento:', error);
      return false;
    }
  },
};
