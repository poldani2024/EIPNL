import { NextRequest, NextResponse } from 'next/server';
import { readSlots, readBookings } from '@/lib/storage';
import { COORDINATOR_EMAIL } from '@/lib/config';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const coordinatorEmail = searchParams.get('coordinatorEmail') || '';

  if (coordinatorEmail.toLowerCase() !== COORDINATOR_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  const slotsData = readSlots();
  const bookingsData = readBookings();

  const rows = bookingsData.bookings
    .map(booking => {
      const slot = slotsData.slots.find(s => s.id === booking.slotId);
      if (!slot) return null;
      const [year, month, day] = slot.date.split('-');
      return {
        'Nombre del Alumno': booking.studentName,
        'Email': booking.studentEmail,
        'Fecha': `${day}/${month}/${year}`,
        'Horario': `${slot.startTime} - ${slot.endTime}`,
        'Fecha de Reserva': new Date(booking.bookedAt).toLocaleString('es-AR'),
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      if (!a || !b) return 0;
      return a['Fecha'].localeCompare(b['Fecha']) || a['Horario'].localeCompare(b['Horario']);
    });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  // Column widths
  worksheet['!cols'] = [
    { wch: 30 }, { wch: 35 }, { wch: 14 }, { wch: 18 }, { wch: 22 }
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'Turnos');

  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toLocaleDateString('es-AR').replace(/\//g, '-');
  return new NextResponse(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="turnos-${today}.xlsx"`,
    },
  });
}
