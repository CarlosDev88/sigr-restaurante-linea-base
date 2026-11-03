import type { Metadata } from "next";
import Link from "next/link";
import { Navegacion } from "@/components/navegacion";
import "./globals.css";

export const metadata: Metadata = {
  title: "SIGR - Gestión de Restaurante",
  description: "Sistema Integral de Gestión de Restaurante v1.1.0",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-stone-200 bg-white">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
            <Link href="/" className="text-lg font-bold text-orange-800">
              SIGR
            </Link>
            <Navegacion />
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
        <footer className="py-4 text-center text-xs text-stone-500">SIGR v1.1.0 · línea base v1.0.0</footer>
      </body>
    </html>
  );
}
