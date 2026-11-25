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

export function Nav({ avisos = 0 }: { avisos?: number }) {
  const ruta = usePathname();
  const activo = (href: string) =>
    href === "/" ? ruta === "/" : href === "/expedientes" ? ruta.startsWith("/expedientes") && ruta !== "/expedientes/nuevo" : ruta === href;
  return (
    <nav className="nav" aria-label="Principal">
      {ENLACES.map((e) => (
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
