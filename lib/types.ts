export interface Slot {
  id: string;
  date: string;        // "YYYY-MM-DD"
  startTime: string;   // "HH:MM"
  endTime: string;     // "HH:MM"
  createdAt: string;
}

export interface Booking {
  id: string;
  slotId: string;
  studentEmail: string;
  studentName: string;
  bookedAt: string;
}

export interface SlotsData {
  version: number;
  slots: Slot[];
}

export interface BookingsData {
  version: number;
  bookings: Booking[];
}

export interface SlotWithBooking extends Slot {
  booking?: Booking;
}
