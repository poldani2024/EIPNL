'use client';

import Link from 'next/link';
import Image from 'next/image';

interface HeaderProps {
  showAdminLink?: boolean;
}

export default function Header({ showAdminLink }: HeaderProps) {
  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
          {/* Logo de la escuela. Reemplazar /logo.png por el archivo oficial si se dispone de él. */}
          <Image
            src="/logo-icon.svg"
            alt="PNL & Coaching"
            width={48}
            height={48}
            className="object-contain flex-shrink-0"
            priority
          />
          <div className="leading-none">
            <div className="flex items-baseline gap-1">
              <span className="text-[#2f9e9e] font-extrabold text-xl tracking-tight">PNL</span>
              <span className="text-gray-500 font-semibold text-sm">&amp; COACHING</span>
            </div>
            <div className="mt-1">
              <span className="inline-block bg-[#1b2a63] text-white text-[10px] font-semibold tracking-wide px-2 py-0.5 rounded">
                Escuela Iberoamericana
              </span>
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden sm:inline text-sm text-gray-400">Agenda de Turnos</span>
          {showAdminLink && (
            <Link
              href="/admin"
              className="text-sm text-[#2f9e9e] hover:text-[#1b2a63] font-medium transition-colors"
            >
              Coordinación
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
