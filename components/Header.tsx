'use client';

import Link from 'next/link';
import Image from 'next/image';

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '/EIPNL';

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
            src={`${basePath}/Escuela Iberoamericana.png`}
            alt="PNL & Coaching"
            width={300}
            height={300}
            className="object-contain flex-shrink-0"
            priority
          />
         
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
