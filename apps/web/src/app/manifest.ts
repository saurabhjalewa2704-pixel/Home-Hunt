import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HomeHunt",
    short_name: "HomeHunt",
    description: "Plan viewings, rate homes and see where each one ranks.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#eef1ec",
    theme_color: "#1e5b47",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Today", url: "/schedule" },
      { name: "Add a home", url: "/add" },
    ],
  };
}
