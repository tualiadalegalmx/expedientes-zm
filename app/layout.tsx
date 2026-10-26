import type { Metadata, Viewport } from "next";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/cormorant-garamond/600.css";
import "@fontsource/source-sans-3/400.css";
import "@fontsource/source-sans-3/600.css";
import "./globals.css";


export const metadata: Metadata = {
  title: { default: "Expedientes", template: "%s · Zaida Marmen" },
  description: "Seguimiento interno de expedientes — Zaida Marmen | Tu aliada legal",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "Expedientes", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#2f3a30", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
