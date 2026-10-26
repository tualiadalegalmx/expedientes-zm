import type { NextConfig } from "next";

const config: NextConfig = {
  experimental: {
    // Permite subir escaneos de acuses y actas de hasta 25 MB.
    serverActions: { bodySizeLimit: "25mb" },
  },
};

export default config;
