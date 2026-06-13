import { NextRequest, NextResponse } from 'next/server';
import { readBookings, createBooking, cancelBooking, adminDeleteBooking } from '@/lib/storage';
import { COORDINATOR_EMAIL } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get('email');
  const isAdmin = searchParams.get('admin') === '1';
  const coordinatorEmail = searchParams.get('coordinatorEmail') || '';

  const bookingsData = readBookings();

  if (isAdmin) {
    if (coordinatorEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    return NextResponse.json({ bookings: bookingsData.bookings });
  }

  if (!email) return NextResponse.json({ bookings: [] });

  const bookings = bookingsData.bookings.filter(
    b => b.studentEmail.toLowerCase() === email.toLowerCase()
  );
  return NextResponse.json({ bookings });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { slotId, studentEmail, studentName } = body;

  if (!slotId || !studentEmail || !studentName) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const booking = {
    id: uuidv4(),
    slotId,
    studentEmail: studentEmail.toLowerCase().trim(),
    studentName: studentName.trim(),
    bookedAt: new Date().toISOString(),
  };

  const result = await createBooking(booking);

  if (!result.success) {
    if (result.conflict) {
      return NextResponse.json(
        { error: 'Este turno ya fue reservado por otro alumno. Por favor seleccioná otro.' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Ya tenés un turno reservado. Cancelalo primero para elegir otro.' },
      { status: 409 }
    );
  }

  return NextResponse.json({ booking });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json();
  const { bookingId, studentEmail, coordinatorEmail } = body;

  // Admin cancellation
  if (coordinatorEmail) {
    if (coordinatorEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
    }
    const ok = await adminDeleteBooking(bookingId);
    if (!ok) return NextResponse.json({ error: 'Error al cancelar' }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // Student cancellation
  if (!bookingId || !studentEmail) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const ok = await cancelBooking(bookingId, studentEmail);
  if (!ok) return NextResponse.json({ error: 'No se pudo cancelar el turno' }, { status: 500 });

  return NextResponse.json({ success: true });
}
