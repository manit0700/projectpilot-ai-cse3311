import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProjectPilot AI",
    short_name: "ProjectPilot",
    description: "Student-focused AI project manager for class projects, hackathons, and portfolio apps.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7f8",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
