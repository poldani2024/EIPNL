export const WEEK_DAYS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
export const CALENDAR_START_HOUR = 8;
export const CALENDAR_END_HOUR = 20;
export const SLOT_STEP_MINUTES = 30;
export const SLOT_DURATIONS = [30, 60, 90, 120];

export function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function toTimeKey(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

// Un turno "ya pasó" cuando su hora de fin (fecha + endTime, hora local)
// es anterior al momento actual.
export function isSlotPast(date: string, endTime: string) {
  const slotEnd = new Date(`${date}T${endTime}:00`);
  if (Number.isNaN(slotEnd.getTime())) return false;
  return slotEnd.getTime() < Date.now();
}

export function addMinutes(time: string, minutesToAdd: number) {
  return toTimeKey(timeToMinutes(time) + minutesToAdd);
}

export function getCurrentMonday() {
  const today = new Date();
  const day = today.getDay();
  const distanceFromMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(today);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(today.getDate() + distanceFromMonday);
  return monday;
}

export function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(date.getDate() + days);
  return nextDate;
}

export function getWeekDays(weekStart: Date) {
  return WEEK_DAYS.map((label, index) => {
    const date = addDays(weekStart, index);
    return {
      label,
      date,
      dateKey: toDateKey(date),
      dayNumber: date.getDate(),
      monthLabel: date.toLocaleDateString('es-AR', { month: 'short' }),
    };
  });
}

export function getTimeRows() {
  const rows: string[] = [];
  for (
    let totalMinutes = CALENDAR_START_HOUR * 60;
    totalMinutes < CALENDAR_END_HOUR * 60;
    totalMinutes += SLOT_STEP_MINUTES
  ) {
    rows.push(toTimeKey(totalMinutes));
  }
  return rows;
}

export function formatWeekRange(weekStart: Date) {
  const weekEnd = addDays(weekStart, 5);
  return `${weekStart.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
  })} al ${weekEnd.toLocaleDateString('es-AR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })}`;
}
