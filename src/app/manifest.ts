import type { MetadataRoute } from "next"

// Lets the app be added to a phone or desktop home screen with its own name and icon.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hotel Essentials",
    short_name: "Hotel Essentials",
    description: "Business management for hotel supply companies.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#3B4D56",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
