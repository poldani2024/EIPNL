'use client';

import { useEffect, useState, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { addSlot, cancelBooking, COORDINATOR_EMAIL, deleteSlot, getSlotsWithBookings } from '@/lib/clientStorage';
import { addDays, addMinutes, formatWeekRange, getCurrentMonday, getTimeRows, getWeekDays, SLOT_DURATIONS, timeToMinutes } from '@/lib/calendar';
import Header from '@/components/Header';

interface SlotWithBooking {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  booking: {
    id: string;
    studentEmail: string;
    studentName: string;
    bookedAt: string;
  } | null;
}

function formatDate(dateStr: string) {
  const [year, month, day] = dateStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('es-AR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
}

function groupSlotsByDate(slots: SlotWithBooking[]) {
  const grouped: Record<string, SlotWithBooking[]> = {};
  slots.forEach(slot => {
    if (!grouped[slot.date]) grouped[slot.date] = [];
    grouped[slot.date].push(slot);
  });
  return grouped;
}

export default function AdminPage() {
  const [email, setEmail] = useState('');
  const [coordinatorEmail, setCoordinatorEmail] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  const [slots, setSlots] = useState<SlotWithBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedDuration, setSelectedDuration] = useState(30);
  const [addingSlotKey, setAddingSlotKey] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => getCurrentMonday());

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!coordinatorEmail) return;
    setLoading(true);
    try {
      setSlots(await getSlotsWithBookings());
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar los turnos.' });
    } finally {
      setLoading(false);
    }
  }, [coordinatorEmail]);

  // No se usa persistencia local: limpiamos cualquier dato viejo del navegador.
  useEffect(() => {
    try {
      ['eipnl_coordinator', 'eipnl_slots', 'eipnl_bookings'].forEach(
        key => localStorage.removeItem(key)
      );
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    if (coordinatorEmail) window.setTimeout(fetchSlots, 0);
  }, [coordinatorEmail, fetchSlots]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail !== COORDINATOR_EMAIL.toLowerCase()) {
        setLoginError('Email no autorizado. Solo la coordinadora puede ingresar aquí.');
      } else {
        setCoordinatorEmail(normalizedEmail);
      }
    } catch {
      setLoginError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    setCoordinatorEmail(null);
    setSlots([]);
  }

  async function handleAddSlotFromCalendar(date: string, startTime: string) {
    const endTime = addMinutes(startTime, selectedDuration);
    const slotKey = `${date}-${startTime}`;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = timeToMinutes(endTime);
    const calendarEndMinutes = timeToMinutes('20:00');
    const hasConflict = slots.some(slot => {
      if (slot.date !== date) return false;
      const slotStart = timeToMinutes(slot.startTime);
      const slotEnd = timeToMinutes(slot.endTime);
      return startMinutes < slotEnd && endMinutes > slotStart;
    });

    if (endMinutes > calendarEndMinutes) {
      setMessage({ type: 'error', text: 'El turno no puede terminar después de las 20:00 hs.' });
      return;
    }

    if (hasConflict) {
      setMessage({ type: 'error', text: 'Ya existe un turno publicado que se superpone con ese día y horario.' });
      return;
    }

    setAddingSlotKey(slotKey);
    setMessage(null);
    try {
      await addSlot(date, startTime, endTime);
      setMessage({ type: 'success', text: `Turno de ${selectedDuration} minutos agregado correctamente.` });
      await fetchSlots();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setAddingSlotKey(null);
    }
  }

  async function handleDeleteSlot(slotId: string, hasBooking: boolean) {
    const confirmMsg = hasBooking
      ? '¡Atención! Este turno tiene un alumno inscripto. ¿Querés eliminar el turno y cancelar la reserva?'
      : '¿Estás seguro/a de que querés eliminar este turno?';
    if (!confirm(confirmMsg)) return;

    setDeletingId(slotId);
    setMessage(null);
    try {
      // Cancel booking first if exists
      if (hasBooking) {
        const slot = slots.find(s => s.id === slotId);
        if (slot?.booking) {
          await cancelBooking(slot.booking.id);
        }
      }
      await deleteSlot(slotId);
      setMessage({ type: 'success', text: 'Turno eliminado.' });
      await fetchSlots();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setDeletingId(null);
    }
  }

  async function handleCancelBooking(bookingId: string) {
    if (!confirm('¿Querés cancelar la reserva de este alumno?')) return;
    setCancellingId(bookingId);
    setMessage(null);
    try {
      await cancelBooking(bookingId);
      setMessage({ type: 'success', text: 'Reserva cancelada.' });
      await fetchSlots();
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setCancellingId(null);
    }
  }

  async function handleExport() {
    if (!coordinatorEmail) return;
    setExporting(true);
    try {
      const rows = slots
        .filter(slot => slot.booking)
        .map(slot => ({
          'Nombre del Alumno': slot.booking!.studentName,
          'Email': slot.booking!.studentEmail,
          'Fecha': slot.date.split('-').reverse().join('/'),
          'Horario': `${slot.startTime} - ${slot.endTime}`,
          'Fecha de Reserva': new Date(slot.booking!.bookedAt).toLocaleString('es-AR'),
        }));
      const worksheet = XLSX.utils.json_to_sheet(rows);
      worksheet['!cols'] = [
        { wch: 30 }, { wch: 35 }, { wch: 14 }, { wch: 18 }, { wch: 22 }
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Turnos');
      const workbookArray = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([workbookArray], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const today = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
      a.href = url;
      a.download = `turnos-${today}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setMessage({ type: 'error', text: 'Error al exportar.' });
    } finally {
      setExporting(false);
    }
  }

  // Login screen
  if (!coordinatorEmail) {
    return (
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md border border-gray-100">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 bg-[#1b2a63] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#1b2a63] mb-1 text-center">Panel de Coordinación</h2>
            <p className="text-gray-500 text-sm text-center mb-6">
              Ingresá con tu email de coordinadora para acceder
            </p>
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="coordinadora@eipnl.edu.ar"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b2a63] focus:border-transparent outline-none transition"
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#1b2a63] hover:bg-[#14215a] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
              >
                {loginLoading ? 'Verificando...' : 'Ingresar'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  const grouped = groupSlotsByDate(slots);
  const sortedDates = Object.keys(grouped).sort();
  const bookedCount = slots.filter(s => s.booking).length;
  const totalCount = slots.length;
  const weekDays = getWeekDays(weekStart);
  const timeRows = getTimeRows();

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Admin bar */}
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 mb-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#1b2a63] text-white px-2 py-0.5 rounded-full font-semibold">
              COORDINADORA
            </span>
            <span className="text-sm text-gray-600">{coordinatorEmail}</span>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-500 hover:text-red-600 transition-colors"
          >
            Salir
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

        {/* Stats + Export */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-[#1b2a63]">{totalCount}</div>
            <div className="text-sm text-gray-500 mt-1">Turnos publicados</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-green-600">{bookedCount}</div>
            <div className="text-sm text-gray-500 mt-1">Turnos reservados</div>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-center">
            <div className="text-3xl font-bold text-orange-500">{totalCount - bookedCount}</div>
            <div className="text-sm text-gray-500 mt-1">Turnos disponibles</div>
          </div>
        </div>

        {/* Export button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={handleExport}
            disabled={exporting || bookedCount === 0}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {exporting ? 'Exportando...' : 'Descargar Excel'}
          </button>
        </div>

        {/* Calendar add slot */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#1b2a63]">Publicar turnos en calendario</h2>
              <p className="text-sm text-gray-500 mt-1">
                Lunes a sábado, de 08:00 a 20:00 hs. Al hacer clic se crea un turno de 30 minutos por defecto.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Duración</label>
              <select
                value={selectedDuration}
                onChange={e => setSelectedDuration(Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-[#1b2a63]"
              >
                {SLOT_DURATIONS.map(duration => (
                  <option key={duration} value={duration}>{duration} minutos</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
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

          <div className="overflow-x-auto rounded-2xl border border-gray-100">
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
                    const slotKey = `${day.dateKey}-${time}`;
                    return (
                      <div key={slotKey} className="min-h-[66px] border-l border-gray-100 p-1.5">
                        {slot ? (
                          <div className={`h-full rounded-xl border p-2 text-xs ${slot.booking ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
                            <div className="font-bold text-gray-800">{slot.startTime} - {slot.endTime}</div>
                            <div className="mt-1 text-[11px] font-semibold text-gray-500">
                              {slot.booking ? `Reservado: ${slot.booking.studentName}` : 'Publicado / disponible'}
                            </div>
                            <button
                              onClick={() => handleDeleteSlot(slot.id, !!slot.booking)}
                              disabled={deletingId === slot.id}
                              className="mt-2 w-full rounded-lg border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                            >
                              {deletingId === slot.id ? 'Eliminando...' : 'Eliminar'}
                            </button>
                          </div>
                        ) : coveringSlot ? (
                          <div className="h-full rounded-xl border border-gray-200 bg-gray-100 p-2 text-xs font-semibold text-gray-400">
                            Continúa {coveringSlot.startTime} - {coveringSlot.endTime}
                          </div>
                        ) : (
                          <button
                            onClick={() => handleAddSlotFromCalendar(day.dateKey, time)}
                            disabled={addingSlotKey === slotKey}
                            className="h-full w-full rounded-xl border border-dashed border-gray-300 bg-gray-50/70 p-2 text-xs font-semibold text-gray-400 hover:border-[#1b2a63] hover:bg-blue-50 hover:text-[#1b2a63] disabled:opacity-50"
                          >
                            {addingSlotKey === slotKey ? 'Agregando...' : `+ ${time}`}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Slots list */}
        <h2 className="text-lg font-bold text-[#1b2a63] mb-4">Turnos publicados</h2>

        {loading ? (
          <div className="text-center py-10 text-gray-400">Cargando...</div>
        ) : slots.length === 0 ? (
          <div className="text-center py-10 bg-white rounded-2xl border border-gray-100">
            <p className="text-gray-400">Todavía no hay turnos publicados. Usá el formulario de arriba para agregar.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2 capitalize pl-1">
                  {formatDate(date)}
                </h3>
                <div className="space-y-2">
                  {grouped[date].map(slot => (
                    <div
                      key={slot.id}
                      className={`bg-white rounded-xl border px-4 py-3 flex flex-wrap items-center gap-3 justify-between ${
                        slot.booking ? 'border-green-200' : 'border-gray-200'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${slot.booking ? 'bg-green-500' : 'bg-gray-300'}`} />
                        <div>
                          <span className="font-semibold text-gray-800">
                            {slot.startTime} – {slot.endTime} hs
                          </span>
                          {slot.booking && (
                            <div className="text-sm text-gray-600 mt-0.5">
                              <span className="font-medium">{slot.booking.studentName}</span>
                              <span className="text-gray-400 ml-2">({slot.booking.studentEmail})</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {slot.booking && (
                          <button
                            onClick={() => handleCancelBooking(slot.booking!.id)}
                            disabled={cancellingId === slot.booking.id}
                            className="text-xs text-orange-600 hover:text-orange-700 border border-orange-200 hover:bg-orange-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {cancellingId === slot.booking.id ? 'Cancelando...' : 'Cancelar reserva'}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSlot(slot.id, !!slot.booking)}
                          disabled={deletingId === slot.id}
                          className="text-xs text-red-600 hover:text-red-700 border border-red-200 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {deletingId === slot.id ? 'Eliminando...' : 'Eliminar turno'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 mt-8 border-t border-gray-200">
        Escuela Iberoamericana de PNL &amp; Coaching — Panel de Coordinación
      </footer>
    </div>
  );
}
