import { type MetadataRoute } from "next";

/**
 * Web app manifest: lets Chrome/Edge "install" Motor IRM as an app (own window,
 * own icon, no address bar). Served at /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Motor IRM",
    short_name: "Motor IRM",
    description: "Administración de taller y venta de repuestos de motocicletas",
    start_url: "/",
    display: "standalone",
    background_color: "#111318",
    theme_color: "#c8202a",
    lang: "es",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
