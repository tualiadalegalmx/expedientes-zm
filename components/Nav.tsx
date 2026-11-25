"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Hoy" },
  { href: "/expedientes", texto: "Expedientes" },
  { href: "/expedientes/nuevo", texto: "Nuevo expediente" },
  { href: "/tareas", texto: "Tareas" },
  { href: "/calendario", texto: "Calendario" },
];

export function Nav({ avisos = 0, tablero = false }: { avisos?: number; tablero?: boolean }) {
  const ruta = usePathname();
  const enlaces = tablero ? [...ENLACES, { href: "/tablero", texto: "Tablero" }] : ENLACES;
  const activo = (href: string) =>
    href === "/" ? ruta === "/" : href === "/expedientes" ? ruta.startsWith("/expedientes") && ruta !== "/expedientes/nuevo" : href === "/tareas" ? ruta === "/tareas" || ruta.startsWith("/cotizaciones") : href === "/tablero" ? ruta === "/tablero" || ruta === "/reporte" : ruta === href;
  return (
    <nav className="nav" aria-label="Principal">
      {enlaces.map((e) => (
        <Link key={e.href} href={e.href} aria-current={activo(e.href) ? "page" : undefined}>
          {e.texto}
          {e.href === "/" && avisos > 0 && (
            <span className="globo" aria-label={`${avisos} ${avisos === 1 ? "aviso" : "avisos"}`}>{avisos > 99 ? "99+" : avisos}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
