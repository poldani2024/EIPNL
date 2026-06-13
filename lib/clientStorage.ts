import { Booking, Slot, SlotWithBooking } from './types';

const SLOTS_KEY = 'eipnl_slots';
const BOOKINGS_KEY = 'eipnl_bookings';

export const COORDINATOR_EMAIL =
  process.env.NEXT_PUBLIC_COORDINATOR_EMAIL || 'murguiondoflorencia@gmail.com';

function readArray<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeArray<T>(key: string, value: T[]) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sortSlots(slots: SlotWithBooking[]) {
  return slots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
  });
}

export function getSlotsWithBookings(): SlotWithBooking[] {
  const slots = readArray<Slot>(SLOTS_KEY);
  const bookings = readArray<Booking>(BOOKINGS_KEY);

  return sortSlots(
    slots.map(slot => ({
      ...slot,
      booking: bookings.find(booking => booking.slotId === slot.id) || null,
    }))
  );
}

export function getBookingsByEmail(email: string): Booking[] {
  return readArray<Booking>(BOOKINGS_KEY).filter(
    booking => booking.studentEmail.toLowerCase() === email.toLowerCase()
  );
}

export function addSlot(date: string, startTime: string, endTime: string): Slot {
  const slots = readArray<Slot>(SLOTS_KEY);
  const slot: Slot = {
    id: crypto.randomUUID(),
    date,
    startTime,
    endTime,
    createdAt: new Date().toISOString(),
  };
  writeArray(SLOTS_KEY, [...slots, slot]);
  return slot;
}

export function deleteSlot(slotId: string) {
  writeArray(SLOTS_KEY, readArray<Slot>(SLOTS_KEY).filter(slot => slot.id !== slotId));
  writeArray(BOOKINGS_KEY, readArray<Booking>(BOOKINGS_KEY).filter(booking => booking.slotId !== slotId));
}

export function createBooking(slotId: string, studentEmail: string, studentName: string): Booking {
  const bookings = readArray<Booking>(BOOKINGS_KEY);
  if (bookings.some(booking => booking.slotId === slotId)) {
    throw new Error('Este turno ya fue reservado por otro alumno. Por favor seleccioná otro.');
  }
  if (bookings.some(booking => booking.studentEmail.toLowerCase() === studentEmail.toLowerCase())) {
    throw new Error('Ya tenés un turno reservado. Cancelalo primero para elegir otro.');
  }

  const booking: Booking = {
    id: crypto.randomUUID(),
    slotId,
    studentEmail: studentEmail.toLowerCase().trim(),
    studentName: studentName.trim(),
    bookedAt: new Date().toISOString(),
  };
  writeArray(BOOKINGS_KEY, [...bookings, booking]);
  return booking;
}

export function cancelBooking(bookingId: string, studentEmail?: string) {
  const normalizedEmail = studentEmail?.toLowerCase();
  writeArray(
    BOOKINGS_KEY,
    readArray<Booking>(BOOKINGS_KEY).filter(booking => {
      if (booking.id !== bookingId) return true;
      return normalizedEmail ? booking.studentEmail.toLowerCase() !== normalizedEmail : false;
    })
  );
}
