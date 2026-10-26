"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ENLACES = [
  { href: "/", texto: "Hoy" },
  { href: "/expedientes", texto: "Expedientes" },
  { href: "/expedientes/nuevo", texto: "Nuevo expediente" },
];

export function Nav() {
  const ruta = usePathname();
  const activo = (href: string) =>
    href === "/" ? ruta === "/" : href === "/expedientes" ? ruta.startsWith("/expedientes") && ruta !== "/expedientes/nuevo" : ruta === href;
  return (
    <nav className="nav" aria-label="Principal">
      {ENLACES.map((e) => (
        <Link key={e.href} href={e.href} aria-current={activo(e.href) ? "page" : undefined}>
          {e.texto}
        </Link>
      ))}
    </nav>
  );
}
