'use client';

import Link from 'next/link';
import Image from 'next/image';

interface HeaderProps {
  showAdminLink?: boolean;
}

export default function Header({ showAdminLink }: HeaderProps) {
  return (
    <header className="bg-[#1a3a6b] text-white shadow-lg">
      <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-90 transition-opacity">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-sm">
            {/* Replace /logo.svg with your school logo */}
            <Image
              src="/logo.svg"
              alt="Logo EIPNL"
              width={52}
              height={52}
              className="object-contain"
            />
          </div>
          <div>
            <div className="font-bold text-lg leading-tight">EIPNL</div>
            <div className="text-blue-200 text-xs">Agenda de Turnos</div>
          </div>
        </Link>

        {showAdminLink && (
          <Link
            href="/admin"
            className="text-sm bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md transition-colors"
          >
            Panel Admin
          </Link>
        )}
      </div>
    </header>
  );
}
