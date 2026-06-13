import fs from 'fs';
import path from 'path';
import { SlotsData, BookingsData } from './types';

const DATA_DIR = path.join(process.cwd(), 'data');
const SLOTS_FILE = path.join(DATA_DIR, 'slots.json');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJSON<T>(filePath: string, defaultValue: T): T {
  ensureDataDir();
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2));
    return defaultValue;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
}

// Atomic update with optimistic locking – retries on version conflict
async function atomicUpdate<T extends { version: number }>(
  filePath: string,
  defaultValue: T,
  updateFn: (data: T) => T | null,
  retries = 8
): Promise<{ success: boolean; data?: T }> {
  for (let i = 0; i < retries; i++) {
    const data = readJSON<T>(filePath, defaultValue);
    const currentVersion = data.version;

    const updated = updateFn(data);
    if (!updated) return { success: false };

    updated.version = currentVersion + 1;

    const tmpPath = filePath + '.tmp.' + process.pid + '.' + Date.now();
    try {
      fs.writeFileSync(tmpPath, JSON.stringify(updated, null, 2), { flag: 'wx' });

      // Version check before rename
      const check = readJSON<T>(filePath, defaultValue);
      if (check.version !== currentVersion) {
        fs.unlinkSync(tmpPath);
        await new Promise(r => setTimeout(r, 30 * (i + 1)));
        continue;
      }

      fs.renameSync(tmpPath, filePath);
      return { success: true, data: updated };
    } catch {
      try { fs.unlinkSync(tmpPath); } catch { /* noop */ }
      await new Promise(r => setTimeout(r, 30 * (i + 1)));
    }
  }
  return { success: false };
}

// --- Slots ---

export function readSlots(): SlotsData {
  return readJSON<SlotsData>(SLOTS_FILE, { version: 0, slots: [] });
}

export async function addSlot(slot: Omit<SlotsData['slots'][0], never>): Promise<boolean> {
  const result = await atomicUpdate<SlotsData>(
    SLOTS_FILE,
    { version: 0, slots: [] },
    (data) => {
      data.slots.push(slot);
      return data;
    }
  );
  return result.success;
}

export async function deleteSlot(slotId: string): Promise<boolean> {
  const result = await atomicUpdate<SlotsData>(
    SLOTS_FILE,
    { version: 0, slots: [] },
    (data) => {
      data.slots = data.slots.filter(s => s.id !== slotId);
      return data;
    }
  );
  return result.success;
}

// --- Bookings ---

export function readBookings(): BookingsData {
  return readJSON<BookingsData>(BOOKINGS_FILE, { version: 0, bookings: [] });
}

// Returns false if slot already taken (concurrency-safe)
export async function createBooking(
  booking: BookingsData['bookings'][0]
): Promise<{ success: boolean; conflict?: boolean }> {
  const result = await atomicUpdate<BookingsData>(
    BOOKINGS_FILE,
    { version: 0, bookings: [] },
    (data) => {
      const alreadyTaken = data.bookings.some(b => b.slotId === booking.slotId);
      if (alreadyTaken) return null;
      const alreadyBooked = data.bookings.some(
        b => b.studentEmail.toLowerCase() === booking.studentEmail.toLowerCase()
      );
      if (alreadyBooked) return null;
      data.bookings.push(booking);
      return data;
    }
  );
  if (result.success) return { success: true };

  // Distinguish conflict vs error
  const current = readBookings();
  const slotTaken = current.bookings.some(b => b.slotId === booking.slotId);
  return { success: false, conflict: slotTaken };
}

export async function cancelBooking(
  bookingId: string,
  studentEmail: string
): Promise<boolean> {
  const result = await atomicUpdate<BookingsData>(
    BOOKINGS_FILE,
    { version: 0, bookings: [] },
    (data) => {
      const idx = data.bookings.findIndex(
        b => b.id === bookingId && b.studentEmail.toLowerCase() === studentEmail.toLowerCase()
      );
      if (idx === -1) return null;
      data.bookings.splice(idx, 1);
      return data;
    }
  );
  return result.success;
}

export async function adminDeleteBooking(bookingId: string): Promise<boolean> {
  const result = await atomicUpdate<BookingsData>(
    BOOKINGS_FILE,
    { version: 0, bookings: [] },
    (data) => {
      data.bookings = data.bookings.filter(b => b.id !== bookingId);
      return data;
    }
  );
  return result.success;
}
