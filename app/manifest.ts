import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "VETIX Distribuidora",
    short_name: "VETIX",
    description: "Sistema de gestión para distribuidoras veterinarias",
    start_url: "/",
    display: "standalone",
    background_color: "#0c0f1a",
    theme_color: "#1e40af",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/api/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/api/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    categories: ["business", "productivity"],
    screenshots: [],
  }
}
