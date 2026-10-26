"use client";
import { useEffect, useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/client";

/**
 * El correo de invitación o de recuperación que Supabase manda por defecto
 * regresa a la página con la sesión en la dirección (#access_token=…).
 * Aquí se guarda esa sesión y se lleva a la persona a elegir su contraseña.
 */
export function SesionDesdeEnlace() {
  const [estado, setEstado] = useState<"nada" | "abriendo" | "error">("nada");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const h = new URLSearchParams(window.location.hash.slice(1));
    const q = new URLSearchParams(window.location.search);
    if (h.get("error") || h.get("error_description")) {
      setEstado("error");
      setMensaje(h.get("error_code") === "otp_expired"
        ? "El enlace del correo ya expiró o ya se usó. Pide a Ricardo que te mande una invitación nueva."
        : "El enlace del correo no es válido. Pide a Ricardo que te mande uno nuevo.");
      return;
    }
    const access_token = h.get("access_token"), refresh_token = h.get("refresh_token");
    const code = q.get("code");
    if (!access_token && !code) return;
    setEstado("abriendo");
    const sb = supabaseNavegador();
    const abrir = access_token && refresh_token
      ? sb.auth.setSession({ access_token, refresh_token })
      : sb.auth.exchangeCodeForSession(code!);
    abrir.then(({ error }) => {
      if (error) { setEstado("error"); setMensaje("No se pudo abrir el enlace. Pide uno nuevo."); return; }
      window.location.replace("/contrasena");
    });
  }, []);

  if (estado === "abriendo") return <p className="aviso" role="status">Abriendo tu acceso…</p>;
  if (estado === "error") return <p className="error" role="alert">{mensaje}</p>;
  return null;
}
