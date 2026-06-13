import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agenda de Turnos - EIPNL",
  description: "Sistema de agendamiento de reuniones con la coordinadora",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
