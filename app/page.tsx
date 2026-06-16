'use client';

import { useEffect, useState, useCallback } from 'react';
import { cancelBooking, createBooking, getBookingsByEmail, getConfig, getSlotsWithBookings } from '@/lib/clientStorage';
import { addDays, formatWeekRange, getCurrentMonday, getTimeRows, getWeekDays, isSlotPast, timeToMinutes } from '@/lib/calendar';
import { buildGoogleCalendarUrl, buildTurnoEvent, downloadICS } from '@/lib/ics';
import Header from '@/components/Header';
import UserSetup from '@/components/UserSetup';

interface SlotWithBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  booking: { id: string; studentEmail: string; studentName: string } | null;
}

interface MyBooking {
  id: string;
  slotId: string;
  studentEmail: string;
  studentName: string;
  bookedAt: string;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotWithBooking[]>([]);
  const [myBooking, setMyBooking] = useState<MyBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getCurrentMonday());
  const [zoomLink, setZoomLink] = useState('');

  // No se usa persistencia local: limpiamos cualquier dato viejo del navegador
  // (versiones anteriores guardaban identidad y turnos en localStorage).
  useEffect(() => {
    try {
      ['eipnl_email', 'eipnl_name', 'eipnl_slots', 'eipnl_bookings'].forEach(
        key => localStorage.removeItem(key)
      );
    } catch {
      /* noop */
    }
  }, []);

  const fetchData = useCallback(async (email: string) => {
    setLoading(true);
    try {
      const [slotsData, bookings, config] = await Promise.all([
        getSlotsWithBookings(),
        getBookingsByEmail(email),
        getConfig(),
      ]);
      setSlots(slotsData);
      setZoomLink(config.zoomLink);

      // Solo cuenta como "mi turno" el que todavía no pasó. Si el turno
      // anterior ya venció, el alumno queda habilitado para reservar otro.
      const slotsById = new Map(slotsData.map(s => [s.id, s]));
      const activeBooking = bookings.find(b => {
        const slot = slotsById.get(b.slotId);
        return slot ? !isSlotPast(slot.date, slot.endTime) : false;
      });
      setMyBooking(activeBooking || null);
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar los turnos. Intentá de nuevo.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (userEmail) window.setTimeout(() => fetchData(userEmail), 0);
  }, [userEmail, fetchData]);

  function handleUserSave(email: string, name: string) {
    setUserEmail(email);
    setUserName(name);
  }

  function handleLogout() {
    setUserEmail(null);
    setUserName(null);
    setSlots([]);
    setMyBooking(null);
  }

  async function handleBook(slotId: string) {
    if (!userEmail || !userName) return;
    setBookingSlotId(slotId);
    setMessage(null);
    try {
      await createBooking(slotId, userEmail, userName);
      setMessage({ type: 'success', text: '¡Turno reservado con éxito!' });
      await fetchData(userEmail);
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Error de conexión. Intentá de nuevo.' });
    } finally {
      setBookingSlotId(null);
    }
  }

  async function handleCancel() {
    if (!userEmail || !myBooking) return;
    if (!confirm('¿Estás seguro/a de que querés cancelar tu turno?')) return;
    setMessage(null);
    try {
      await cancelBooking(myBooking.id, userEmail);
      setMessage({ type: 'success', text: 'Turno cancelado correctamente.' });
      await fetchData(userEmail);
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión. Intentá de nuevo.' });
    }
  }

  if (!userEmail) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1">
          <UserSetup onSave={handleUserSave} />
        </main>
        <footer className="text-center text-xs text-gray-400 py-4 border-t border-gray-200">
          Escuela Iberoamericana de PNL &amp; Coaching — Agenda de Turnos
        </footer>
      </div>
    );
  }

  const weekDays = getWeekDays(weekStart);
  const timeRows = getTimeRows();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Título */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-[#1b2a63]">Reservá tu reunión con la coordinadora</h1>
          <p className="text-gray-500 text-sm mt-1">Elegí el día y horario que mejor te quede. Podés reservar un solo turno.</p>
        </div>

        {/* User info bar */}
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 mb-5 shadow-sm border border-gray-100">
          <div>
            <span className="font-semibold text-gray-800">{userName}</span>
            <span className="text-gray-400 text-sm ml-2">({userEmail})</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Cambiar usuario
          </button>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`rounded-xl px-4 py-3 mb-5 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* My booking highlight */}
        {myBooking && (() => {
          const slot = slots.find(s => s.id === myBooking.slotId);
          if (!slot) return null;
          const calendarEvent = buildTurnoEvent({
            date: slot.date,
            startTime: slot.startTime,
            endTime: slot.endTime,
            studentName: userName ?? undefined,
            zoomLink,
          });
          return (
            <div className="bg-[#1b2a63] text-white rounded-2xl p-5 mb-6 shadow-md">
              <div className="flex items-start justify-between flex-wrap gap-3">
                <div>
                  <div className="text-blue-200 text-xs uppercase tracking-wide mb-1 font-semibold">
                    Tu turno reservado
                  </div>
                  <div className="text-xl font-bold capitalize">{formatDate(slot.date)}</div>
                  <div className="text-blue-100 mt-0.5">
                    {slot.startTime} – {slot.endTime} hs
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="bg-red-500 hover:bg-red-600 text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors"
                >
                  Cancelar turno
                </button>
              </div>
              {zoomLink && (
                <div className="mt-4 border-t border-white/15 pt-3">
                  <div className="text-blue-200 text-xs uppercase tracking-wide mb-2 font-semibold">
                    Reunión por videollamada
                  </div>
                  <a
                    href={zoomLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[#2f9e9e] hover:bg-[#268787] text-white text-sm font-semibold px-4 py-2 transition-colors"
                  >
                    🎥 Unirse a Zoom
                  </a>
                </div>
              )}
              <div className="mt-4 border-t border-white/15 pt-3">
                <div className="text-blue-200 text-xs uppercase tracking-wide mb-2 font-semibold">
                  Agregar a mi calendario
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={buildGoogleCalendarUrl(calendarEvent)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm font-semibold px-4 py-2 transition-colors"
                  >
                    📅 Google Calendar
                  </a>
                  <button
                    onClick={() => downloadICS(calendarEvent)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/25 text-white text-sm font-semibold px-4 py-2 transition-colors"
                  >
                     Apple Calendar (.ics)
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Calendar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1b2a63]">Calendario de turnos disponibles</h2>
            <p className="text-sm text-gray-500">Lunes a sábado, de 08:00 a 20:00 hs. Todos los horarios están en formato 24 hs.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#1b2a63]"
            >
              ← Semana anterior
            </button>
            <span className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-[#1b2a63]">
              {formatWeekRange(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:border-[#1b2a63]"
            >
              Semana siguiente →
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando turnos...</div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100 mb-6">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-500 font-medium text-lg">No hay turnos disponibles por el momento.</p>
            <p className="text-gray-400 text-sm mt-1">La coordinadora publicará los horarios próximamente.</p>
          </div>
        ) : (
          <div className="overflow-x-auto bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="min-w-[900px]">
              <div className="grid grid-cols-[88px_repeat(6,minmax(120px,1fr))] border-b border-gray-100 bg-gray-50">
                <div className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-gray-400">Hora</div>
                {weekDays.map(day => (
                  <div key={day.dateKey} className="px-3 py-3 text-center">
                    <div className="text-sm font-bold text-[#1b2a63]">{day.label}</div>
                    <div className="text-xs text-gray-500 capitalize">{day.dayNumber} {day.monthLabel}</div>
                  </div>
                ))}
              </div>

              {timeRows.map(time => (
                <div key={time} className="grid grid-cols-[88px_repeat(6,minmax(120px,1fr))] border-b border-gray-100 last:border-b-0">
                  <div className="px-3 py-2 text-sm font-semibold text-gray-500 bg-gray-50">{time}</div>
                  {weekDays.map(day => {
                    const slot = slots.find(s => s.date === day.dateKey && s.startTime === time);
                    const coveringSlot = slots.find(s => {
                      if (s.date !== day.dateKey || s.startTime === time) return false;
                      const rowMinutes = timeToMinutes(time);
                      return rowMinutes > timeToMinutes(s.startTime) && rowMinutes < timeToMinutes(s.endTime);
                    });
                    const isTaken = !!slot?.booking;
                    const isMySlot = slot ? myBooking?.slotId === slot.id : false;
                    const isBookingThis = slot ? bookingSlotId === slot.id : false;
                    const hasOtherBooking = !!myBooking && !isMySlot;
                    const isPast = slot ? isSlotPast(slot.date, slot.endTime) : false;

                    return (
                      <div key={`${day.dateKey}-${time}`} className="min-h-[64px] border-l border-gray-100 p-1.5">
                        {slot ? (
                          <div className={`h-full rounded-xl border p-2 text-xs ${
                            isMySlot
                              ? 'border-[#1b2a63] bg-blue-50'
                              : isTaken || isPast
                              ? 'border-gray-200 bg-gray-50 opacity-70'
                              : 'border-green-200 bg-green-50'
                          }`}>
                            <div className="flex items-center justify-between gap-1">
                              <span className="font-bold text-gray-800">{slot.startTime} - {slot.endTime}</span>
                              <span className={`rounded-full px-1.5 py-0.5 font-semibold ${
                                isMySlot
                                  ? 'bg-[#1b2a63] text-white'
                                  : isTaken || isPast
                                  ? 'bg-gray-200 text-gray-500'
                                  : 'bg-green-100 text-green-700'
                              }`}>
                                {isMySlot ? 'Mi turno' : isTaken ? 'Ocupado' : isPast ? 'Vencido' : 'Libre'}
                              </span>
                            </div>
                            {!isTaken && !isPast && !hasOtherBooking && (
                              <button
                                onClick={() => handleBook(slot.id)}
                                disabled={isBookingThis}
                                className="mt-2 w-full rounded-lg bg-[#1b2a63] px-2 py-1.5 font-semibold text-white hover:bg-[#14215a] disabled:opacity-60"
                              >
                                {isBookingThis ? 'Reservando...' : 'Reservar'}
                              </button>
                            )}
                            {!isTaken && !isPast && hasOtherBooking && (
                              <p className="mt-2 text-center text-[11px] text-gray-400">Ya tenés un turno</p>
                            )}
                          </div>
                        ) : coveringSlot ? (
                          <div className="h-full rounded-xl border border-gray-200 bg-gray-100 p-2 text-xs font-semibold text-gray-400">
                            Continúa {coveringSlot.startTime} - {coveringSlot.endTime}
                          </div>
                        ) : (
                          <div className="h-full rounded-xl border border-dashed border-gray-200 bg-gray-50/60" />
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="text-center text-xs text-gray-400 py-4 mt-8 border-t border-gray-200">
        Escuela Iberoamericana de PNL &amp; Coaching — Agenda de Turnos
      </footer>
    </div>
  );
}
