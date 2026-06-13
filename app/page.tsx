'use client';

import { useEffect, useState, useCallback } from 'react';
import { cancelBooking, createBooking, getBookingsByEmail, getSlotsWithBookings } from '@/lib/clientStorage';
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

function groupSlotsByDate(slots: SlotWithBooking[]) {
  const grouped: Record<string, SlotWithBooking[]> = {};
  slots.forEach(slot => {
    if (!grouped[slot.date]) grouped[slot.date] = [];
    grouped[slot.date].push(slot);
  });
  return grouped;
}

export default function HomePage() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [slots, setSlots] = useState<SlotWithBooking[]>([]);
  const [myBooking, setMyBooking] = useState<MyBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  useEffect(() => {
    window.setTimeout(() => {
      const email = localStorage.getItem('eipnl_email');
      const name = localStorage.getItem('eipnl_name');
      if (email && name) {
        setUserEmail(email);
        setUserName(name);
      }
    }, 0);
  }, []);

  const fetchData = useCallback((email: string) => {
    setLoading(true);
    try {
      setSlots(getSlotsWithBookings());
      setMyBooking(getBookingsByEmail(email)[0] || null);
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
    localStorage.setItem('eipnl_email', email);
    localStorage.setItem('eipnl_name', name);
    setUserEmail(email);
    setUserName(name);
  }

  function handleLogout() {
    localStorage.removeItem('eipnl_email');
    localStorage.removeItem('eipnl_name');
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
      createBooking(slotId, userEmail, userName);
      setMessage({ type: 'success', text: '¡Turno reservado con éxito!' });
      fetchData(userEmail);
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
      cancelBooking(myBooking.id, userEmail);
      setMessage({ type: 'success', text: 'Turno cancelado correctamente.' });
      fetchData(userEmail);
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

  const grouped = groupSlotsByDate(slots);
  const sortedDates = Object.keys(grouped).sort();

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
          return slot ? (
            <div className="bg-[#1b2a63] text-white rounded-2xl p-5 mb-6 shadow-md">
              <div className="flex items-center justify-between flex-wrap gap-3">
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
            </div>
          ) : null;
        })()}

        {/* Slots */}
        {!loading && slots.length > 0 && (
          <h2 className="text-lg font-bold text-[#1b2a63] mb-4">Turnos disponibles</h2>
        )}

        {loading ? (
          <div className="text-center py-16 text-gray-400">Cargando turnos...</div>
        ) : slots.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">📅</div>
            <p className="text-gray-500 font-medium text-lg">No hay turnos disponibles por el momento.</p>
            <p className="text-gray-400 text-sm mt-1">La coordinadora publicará los horarios próximamente.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedDates.map(date => (
              <div key={date}>
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 capitalize pl-1">
                  {formatDate(date)}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {grouped[date].map(slot => {
                    const isTaken = !!slot.booking;
                    const isMySlot = myBooking?.slotId === slot.id;
                    const isBookingThis = bookingSlotId === slot.id;
                    const hasOtherBooking = !!myBooking && !isMySlot;

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-xl border-2 p-4 transition-all ${
                          isMySlot
                            ? 'border-[#1b2a63] bg-blue-50 shadow-sm'
                            : isTaken
                            ? 'border-gray-200 bg-gray-50 opacity-60'
                            : 'border-gray-200 bg-white hover:border-[#1b2a63] hover:shadow-sm cursor-default'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <div className="font-bold text-gray-800 text-xl">{slot.startTime}</div>
                            <div className="text-gray-400 text-sm">hasta {slot.endTime} hs</div>
                          </div>
                          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
                            isMySlot
                              ? 'bg-[#1b2a63] text-white'
                              : isTaken
                              ? 'bg-gray-200 text-gray-500'
                              : 'bg-green-100 text-green-700'
                          }`}>
                            {isMySlot ? 'Mi turno' : isTaken ? 'Ocupado' : 'Disponible'}
                          </span>
                        </div>

                        {!isTaken && !hasOtherBooking && (
                          <button
                            onClick={() => handleBook(slot.id)}
                            disabled={isBookingThis}
                            className="w-full bg-[#1b2a63] hover:bg-[#14215a] disabled:opacity-60 text-white text-sm font-semibold py-2 rounded-lg transition-colors"
                          >
                            {isBookingThis ? 'Reservando...' : 'Reservar turno'}
                          </button>
                        )}

                        {!isTaken && hasOtherBooking && (
                          <p className="text-xs text-gray-400 text-center pt-1">
                            Ya tenés un turno reservado
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-gray-400 py-4 mt-8 border-t border-gray-200">
        Escuela Iberoamericana de PNL &amp; Coaching — Agenda de Turnos
      </footer>
    </div>
  );
}
