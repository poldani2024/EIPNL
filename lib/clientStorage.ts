import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from './firebase';
import { isSlotPast } from './calendar';
import { Booking, Slot, SlotWithBooking } from './types';

// Los datos ahora viven en Firestore (base compartida en la nube), de modo
// que la coordinadora y los alumnos ven exactamente la misma información
// desde cualquier dispositivo, y nada se pierde al limpiar el navegador.

export const COORDINATOR_EMAIL =
  process.env.NEXT_PUBLIC_COORDINATOR_EMAIL || 'murguiondoflorencia@gmail.com';

const slotsCol = collection(db, 'slots');
const bookingsCol = collection(db, 'bookings');

function sortSlots(slots: SlotWithBooking[]) {
  return slots.sort((a, b) => {
    const dateCompare = a.date.localeCompare(b.date);
    return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
  });
}

export async function getSlotsWithBookings(): Promise<SlotWithBooking[]> {
  const [slotsSnap, bookingsSnap] = await Promise.all([
    getDocs(slotsCol),
    getDocs(bookingsCol),
  ]);

  const slots = slotsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Slot);
  const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking);

  return sortSlots(
    slots.map(slot => ({
      ...slot,
      booking: bookings.find(booking => booking.slotId === slot.id) || null,
    }))
  );
}

export async function getBookingsByEmail(email: string): Promise<Booking[]> {
  const q = query(bookingsCol, where('studentEmail', '==', email.toLowerCase().trim()));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }) as Booking);
}

export async function addSlot(date: string, startTime: string, endTime: string): Promise<Slot> {
  const id = crypto.randomUUID();
  const slot: Slot = { id, date, startTime, endTime, createdAt: new Date().toISOString() };
  await setDoc(doc(slotsCol, id), {
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    createdAt: slot.createdAt,
  });
  return slot;
}

export async function deleteSlot(slotId: string): Promise<void> {
  // Elimina el turno y cualquier reserva asociada.
  const relatedBookings = await getDocs(query(bookingsCol, where('slotId', '==', slotId)));
  await Promise.all([
    deleteDoc(doc(slotsCol, slotId)),
    ...relatedBookings.docs.map(d => deleteDoc(d.ref)),
  ]);
}

export async function createBooking(
  slotId: string,
  studentEmail: string,
  studentName: string
): Promise<Booking> {
  const email = studentEmail.toLowerCase().trim();
  const name = studentName.trim();

  // No se puede reservar un turno que ya pasó (o que ya no existe).
  const targetSlotSnap = await getDoc(doc(slotsCol, slotId));
  if (!targetSlotSnap.exists()) {
    throw new Error('Este turno ya no está disponible. Actualizá la página.');
  }
  const targetSlot = targetSlotSnap.data() as Omit<Slot, 'id'>;
  if (isSlotPast(targetSlot.date, targetSlot.endTime)) {
    throw new Error('Este turno ya pasó. Elegí uno disponible.');
  }

  // Regla: un alumno solo puede tener un turno VIGENTE a la vez. Puede sacar
  // uno nuevo si su turno anterior ya pasó (o si ese turno fue eliminado).
  const existing = await getDocs(query(bookingsCol, where('studentEmail', '==', email)));
  if (!existing.empty) {
    const slotsSnap = await getDocs(slotsCol);
    const slotsById = new Map(slotsSnap.docs.map(d => [d.id, d.data() as Omit<Slot, 'id'>]));
    const hasActiveBooking = existing.docs.some(d => {
      const slot = slotsById.get((d.data() as Booking).slotId);
      return slot ? !isSlotPast(slot.date, slot.endTime) : false;
    });
    if (hasActiveBooking) {
      throw new Error('Ya tenés un turno reservado. Cancelalo primero o esperá a que pase para elegir otro.');
    }
  }

  // La reserva usa el slotId como id del documento: así la transacción
  // garantiza de forma atómica que un mismo turno no se reserve dos veces.
  const bookingRef = doc(bookingsCol, slotId);
  const booking: Booking = {
    id: slotId,
    slotId,
    studentEmail: email,
    studentName: name,
    bookedAt: new Date().toISOString(),
  };

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(bookingRef);
    if (snap.exists()) {
      throw new Error('Este turno ya fue reservado por otro alumno. Por favor seleccioná otro.');
    }
    tx.set(bookingRef, {
      slotId: booking.slotId,
      studentEmail: booking.studentEmail,
      studentName: booking.studentName,
      bookedAt: booking.bookedAt,
    });
  });

  return booking;
}

export async function cancelBooking(bookingId: string, studentEmail?: string): Promise<void> {
  const ref = doc(bookingsCol, bookingId);

  // Si se pasa el email (cancelación del propio alumno), validamos que sea
  // el dueño de la reserva antes de borrarla.
  if (studentEmail) {
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const owner = (snap.data().studentEmail as string)?.toLowerCase();
    if (owner !== studentEmail.toLowerCase()) return;
  }

  await deleteDoc(ref);
}
