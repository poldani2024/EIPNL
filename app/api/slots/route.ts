import { NextRequest, NextResponse } from 'next/server';
import { readSlots, readBookings, addSlot, deleteSlot } from '@/lib/storage';
import { COORDINATOR_EMAIL } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';

export async function GET() {
  const slotsData = readSlots();
  const bookingsData = readBookings();

  const slots = slotsData.slots
    .map(slot => ({
      ...slot,
      booking: bookingsData.bookings.find(b => b.slotId === slot.id) || null,
    }))
    .sort((a, b) => {
      const dateCompare = a.date.localeCompare(b.date);
      return dateCompare !== 0 ? dateCompare : a.startTime.localeCompare(b.startTime);
    });

  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, startTime, endTime, coordinatorEmail } = body;

  if (!coordinatorEmail || coordinatorEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (!date || !startTime || !endTime) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const slot = {
    id: uuidv4(),
    date,
    startTime,
    endTime,
    createdAt: new Date().toISOString(),
  };

  const ok = await addSlot(slot);
  if (!ok) return NextResponse.json({ error: 'Error al guardar' }, { status: 500 });

  return NextResponse.json({ slot });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { slotId, coordinatorEmail } = body;

  if (!coordinatorEmail || coordinatorEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const ok = await deleteSlot(slotId);
  if (!ok) return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 });

  return NextResponse.json({ success: true });
}
