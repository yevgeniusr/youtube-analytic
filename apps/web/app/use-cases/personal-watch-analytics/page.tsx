import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Personal YouTube Watch Analytics from Google Takeout",
  description:
    "Use ViewPulse to rank channels, map watch times, and explore your YouTube history from a Takeout file — parsed locally in your browser.",
  path: "/use-cases/personal-watch-analytics",
  keywords: [
    "personal youtube analytics",
    "google takeout watch history",
    "youtube watch history analyzer",
    "local youtube statistics"
  ]
});

export default function PersonalWatchAnalyticsPage() {
  const jsonLd = softwareAppJsonLd(
    "Personal YouTube watch analytics",
    "Analyze your own watch history from Google Takeout with ViewPulse. Client-side parsing and charts.",
    "Personal watch history rankings and timelines"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Personal watch analytics"
      lead="Turn your Takeout export into a clear picture of who you watch, when you watch, and how your habits evolved — without sending your history to a server."
      bullets={[
        "Upload watch-history.html or watch-history.json; parsing runs entirely in your browser",
        "See channel rankings, totals, date range, and peak viewing hours",
        "Brush the timeline to focus on a month, a year, or your full archive",
        "Use the OpenClaw-style export (optional, BYOK) to copy structured context for your own AI workflows"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Who this is for</h2>
      <p>
        Anyone curious about their own YouTube diet: which creators dominate your time, whether you cluster
        viewing at night or on weekends, and how activity compares across years. ViewPulse is built for{" "}
        <strong>personal</strong> history files from Takeout, not for channel-owner Studio metrics.
      </p>
      <h2>How to get started</h2>
      <p>
        Request a Takeout that includes YouTube watch history, unzip it, then drop the watch-history file on
        the upload zone on the home page. If you only need history, you can narrow the Takeout to YouTube data
        only to keep the download smaller.
      </p>
    </UseCasePage>
  );
}
