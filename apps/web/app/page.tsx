import { createMetadata, softwareAppJsonLd } from "@/lib/seo";
import { HomeClient } from "@/components/HomeClient";

export const metadata = createMetadata({
  title: "YouTube History Analyzer — See Your Watch Patterns",
  description:
    "Open-source YouTube history analyzer: Takeout upload, local charts and brushable timeline, YouTube vs Music split, optional Games, and BYOK AI exports (OpenClaw-style context, recs, caregiver report, images). No server-side storage of your history for core analytics.",
  path: "",
  keywords: [
    "youtube history analyzer",
    "youtube watch history analytics",
    "google takeout youtube",
    "personal youtube statistics",
    "youtube viewing habits",
    "youtube watch history games",
    "openclaw user md youtube"
  ]
});

export default function HomePage() {
  const jsonLd = softwareAppJsonLd(
    "YouTube History Analyzer by Self Degree",
    "Upload Google Takeout watch history for client-side analytics, optional history games, and optional BYOK AI export tools.",
    "Personal YouTube watch history analytics, games, and exports"
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <HomeClient />
    </>
  );
}
