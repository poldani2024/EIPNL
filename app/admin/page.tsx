'use client';

import { useEffect, useState, useCallback } from 'react';
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

  // New slot form
  const [newDate, setNewDate] = useState('');
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!coordinatorEmail) return;
    setLoading(true);
    try {
      const res = await fetch('/api/slots');
      const data = await res.json();
      setSlots(data.slots || []);
    } catch {
      setMessage({ type: 'error', text: 'Error al cargar los turnos.' });
    } finally {
      setLoading(false);
    }
  }, [coordinatorEmail]);

  useEffect(() => {
    const saved = localStorage.getItem('eipnl_coordinator');
    if (saved) setCoordinatorEmail(saved);
  }, []);

  useEffect(() => {
    if (coordinatorEmail) fetchSlots();
  }, [coordinatorEmail, fetchSlots]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      // Validate by trying to fetch bookings as admin
      const res = await fetch(
        `/api/bookings?admin=1&coordinatorEmail=${encodeURIComponent(email.trim())}`
      );
      if (res.status === 403) {
        setLoginError('Email no autorizado. Solo la coordinadora puede ingresar aquí.');
      } else if (res.ok) {
        localStorage.setItem('eipnl_coordinator', email.trim().toLowerCase());
        setCoordinatorEmail(email.trim().toLowerCase());
      } else {
        setLoginError('Error al verificar el email. Intentá de nuevo.');
      }
    } catch {
      setLoginError('Error de conexión. Intentá de nuevo.');
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem('eipnl_coordinator');
    setCoordinatorEmail(null);
    setSlots([]);
  }

  async function handleAddSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newStart || !newEnd) {
      setMessage({ type: 'error', text: 'Completá todos los campos del turno.' });
      return;
    }
    if (newEnd <= newStart) {
      setMessage({ type: 'error', text: 'El horario de fin debe ser posterior al de inicio.' });
      return;
    }
    setAddingSlot(true);
    setMessage(null);
    try {
      const res = await fetch('/api/slots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: newDate, startTime: newStart, endTime: newEnd, coordinatorEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al agregar el turno.' });
      } else {
        setMessage({ type: 'success', text: 'Turno agregado correctamente.' });
        setNewDate('');
        setNewStart('');
        setNewEnd('');
        await fetchSlots();
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión.' });
    } finally {
      setAddingSlot(false);
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
          await fetch('/api/bookings', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bookingId: slot.booking.id, coordinatorEmail }),
          });
        }
      }
      const res = await fetch('/api/slots', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId, coordinatorEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al eliminar.' });
      } else {
        setMessage({ type: 'success', text: 'Turno eliminado.' });
        await fetchSlots();
      }
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
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, coordinatorEmail }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error || 'Error al cancelar.' });
      } else {
        setMessage({ type: 'success', text: 'Reserva cancelada.' });
        await fetchSlots();
      }
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
      const res = await fetch(`/api/export?coordinatorEmail=${encodeURIComponent(coordinatorEmail)}`);
      if (!res.ok) {
        setMessage({ type: 'error', text: 'Error al exportar.' });
        return;
      }
      const blob = await res.blob();
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
              <div className="w-12 h-12 bg-[#1a3a6b] rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#1a3a6b] mb-1 text-center">Panel de Coordinación</h2>
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
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a6b] focus:border-transparent outline-none transition"
                  required
                />
              </div>
              {loginError && (
                <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{loginError}</p>
              )}
              <button
                type="submit"
                disabled={loginLoading}
                className="w-full bg-[#1a3a6b] hover:bg-[#14306b] disabled:opacity-60 text-white font-semibold py-2.5 rounded-lg transition-colors"
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

  return (
    <div className="flex flex-col min-h-screen">
      <Header />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6">
        {/* Admin bar */}
        <div className="flex items-center justify-between bg-white rounded-xl px-4 py-3 mb-5 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#1a3a6b] text-white px-2 py-0.5 rounded-full font-semibold">
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
            <div className="text-3xl font-bold text-[#1a3a6b]">{totalCount}</div>
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

        {/* Add slot form */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="text-lg font-bold text-[#1a3a6b] mb-4">Agregar nuevo turno</h2>
          <form onSubmit={handleAddSlot} className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[140px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fecha</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a6b] outline-none text-sm"
                required
              />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Desde</label>
              <input
                type="time"
                value={newStart}
                onChange={e => setNewStart(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a6b] outline-none text-sm"
                required
              />
            </div>
            <div className="flex-1 min-w-[110px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Hasta</label>
              <input
                type="time"
                value={newEnd}
                onChange={e => setNewEnd(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1a3a6b] outline-none text-sm"
                required
              />
            </div>
            <button
              type="submit"
              disabled={addingSlot}
              className="bg-[#1a3a6b] hover:bg-[#14306b] disabled:opacity-60 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
            >
              {addingSlot ? 'Agregando...' : '+ Agregar'}
            </button>
          </form>
        </div>

        {/* Slots list */}
        <h2 className="text-lg font-bold text-[#1a3a6b] mb-4">Turnos publicados</h2>

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
        EIPNL — Panel de Coordinación
      </footer>
    </div>
  );
}
