// Generación de eventos de calendario (iCalendar / Google Calendar) en el
// navegador, sin necesidad de backend.

// Argentina usa UTC-3 todo el año (no hay horario de verano), por lo que
// podemos fijar el offset y obtener el instante absoluto correcto sin importar
// la zona horaria del dispositivo del usuario.
const AR_OFFSET = '-03:00';

export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "HH:MM"
  endTime: string; // "HH:MM"
}

// Convierte fecha + hora (horario de Argentina) al formato UTC de iCalendar:
// "YYYYMMDDTHHMMSSZ".
function toICSStamp(date: string, time: string) {
  const instant = new Date(`${date}T${time}:00${AR_OFFSET}`);
  return instant.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function nowStamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function buildGoogleCalendarUrl(event: CalendarEvent) {
  const start = toICSStamp(event.date, event.startTime);
  const end = toICSStamp(event.date, event.endTime);
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${start}/${end}`,
  });
  if (event.description) params.set('details', event.description);
  if (event.location) params.set('location', event.location);
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function buildICS(event: CalendarEvent) {
  const start = toICSStamp(event.date, event.startTime);
  const end = toICSStamp(event.date, event.endTime);
  const uid = `${start}-${Math.random().toString(36).slice(2)}@eipnl`;

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EIPNL//Agenda de Turnos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowStamp()}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];
  if (event.description) lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  if (event.location) lines.push(`LOCATION:${escapeICS(event.location)}`);
  lines.push('END:VEVENT', 'END:VCALENDAR');

  return lines.join('\r\n');
}

export function downloadICS(event: CalendarEvent, filename = 'turno-eipnl.ics') {
  const blob = new Blob([buildICS(event)], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// Arma el evento de un turno de la escuela, incluyendo (si existe) el link de
// Zoom en la ubicación y la descripción para que el calendario muestre el
// botón de "Unirse".
export function buildTurnoEvent(opts: {
  date: string;
  startTime: string;
  endTime: string;
  studentName?: string;
  zoomLink?: string;
}): CalendarEvent {
  const { date, startTime, endTime, studentName, zoomLink } = opts;
  const description: string[] = [];
  if (studentName) description.push(`Turno reservado por ${studentName}.`);
  description.push('Escuela Iberoamericana de PNL & Coaching.');
  if (zoomLink) description.push(`Unirse a la reunión: ${zoomLink}`);

  return {
    title: 'Reunión con la coordinadora — EIPNL',
    description: description.join(' '),
    location: zoomLink || 'Escuela Iberoamericana de PNL & Coaching',
    date,
    startTime,
    endTime,
  };
}

