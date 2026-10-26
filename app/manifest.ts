import type { MetadataRoute } from "next";

// Permite "Agregar a pantalla de inicio" en el iPad y el celular.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Expedientes · Zaida Marmen",
    short_name: "Expedientes",
    start_url: "/",
    display: "standalone",
    background_color: "#ebe7df",
    theme_color: "#2f3a30",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
