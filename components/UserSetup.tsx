'use client';

import { useState } from 'react';

interface UserSetupProps {
  onSave: (email: string, name: string) => void;
}

export default function UserSetup({ onSave }: UserSetupProps) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Por favor ingresá un email válido.');
      return;
    }
    if (trimmedName.length < 2) {
      setError('Por favor ingresá tu nombre completo.');
      return;
    }

    onSave(trimmedEmail, trimmedName);
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 w-full max-w-md border border-gray-100">
        <h2 className="text-2xl font-bold text-[#1b2a63] mb-1 text-center">Bienvenido/a</h2>
        <p className="text-gray-500 text-sm text-center mb-6">
          Ingresá tus datos para reservar un turno con la coordinadora
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nombre completo
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: María González"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b2a63] focus:border-transparent outline-none transition"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email institucional
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="tu.nombre@ejemplo.com"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1b2a63] focus:border-transparent outline-none transition"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            className="w-full bg-[#1b2a63] hover:bg-[#14215a] text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Continuar
          </button>
        </form>
      </div>
    </div>
  );
}
