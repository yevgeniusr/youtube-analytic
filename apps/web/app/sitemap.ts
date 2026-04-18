import type { MetadataRoute } from "next";
import { site } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = [
    "",
    "/use-cases",
    "/use-cases/personal-watch-analytics",
    "/use-cases/digital-wellbeing-insights",
    "/use-cases/families-caregivers",
    "/use-cases/video-and-music-split",
    "/use-cases/openclaw-steering",
    "/use-cases/dating-know-me",
    "/use-cases/better-memory",
    "/use-cases/agentic-recommendation-engine"
  ];

  return routes.map((route) => ({
    url: `${site.url}${route}`,
    changeFrequency: "weekly",
    priority: route === "" ? 1 : 0.8,
    lastModified: new Date()
  }));
}
