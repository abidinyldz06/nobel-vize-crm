import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nobel Vize CRM",
    short_name: "Nobel CRM",
    description: "Premium Vize Danışmanlık Yönetim Sistemi",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#07101f",
    theme_color: "#07101f",
    orientation: "portrait",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
