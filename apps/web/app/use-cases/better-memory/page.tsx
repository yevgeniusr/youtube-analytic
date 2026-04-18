import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Revisit What You Watched on YouTube — Memory & Rediscovery",
  description:
    "Use ViewPulse’s timeline and rankings from Google Takeout to remember old favorites, forgotten channels, and what you were watching in a given season — all local.",
  path: "/use-cases/better-memory",
  keywords: [
    "youtube watch history memory",
    "rediscover old youtube videos",
    "takeout watch timeline",
    "personal youtube archive browser"
  ]
});

export default function BetterMemoryPage() {
  const jsonLd = softwareAppJsonLd(
    "Better memory from YouTube watch history",
    "ViewPulse helps you revisit and search your Google Takeout watch history locally with timelines and channel views.",
    "Rediscover past YouTube viewing"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Better memory"
      lead="Human memory drops titles and channels faster than the algorithm does. Your Takeout file is a ground-truth log. ViewPulse turns it into a browsable timeline and rankings so you can answer “what was that series?” or “what was I obsessed with that winter?”"
      bullets={[
        "Scroll and brush the interactive timeline to zoom into a week, month, year, or your full archive",
        "Scan channel rankings to surface creators you forgot you watched for dozens of hours",
        "Use the dashboard’s views of recency and volume to reconstruct eras of your viewing life",
        "No upload to a ViewPulse server for core parsing — reopen the app later with the same file when you need another pass"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>When this shines</h2>
      <p>
        After a trip, a move, or a busy work sprint, your YouTube diet often shifts. The history file preserves
        the trail. ViewPulse makes that trail legible again so you can rediscover a documentary, a music phase,
        or a niche channel without relying on recommendations alone.
      </p>
      <h2>Privacy stays local</h2>
      <p>
        Treat the export like a personal archive. Keep the zip offline when you are not analyzing it, and clear
        the tab when you are finished on a shared machine. Optional AI features are separate; core revisiting
        works without keys or network calls for analytics.
      </p>
    </UseCasePage>
  );
}
