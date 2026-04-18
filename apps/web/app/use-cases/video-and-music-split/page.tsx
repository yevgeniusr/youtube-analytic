import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "YouTube vs YouTube Music — Watch History Split",
  description:
    "When your Google Takeout includes both YouTube and YouTube Music entries, ViewPulse lets you filter and compare them locally.",
  path: "/use-cases/video-and-music-split",
  keywords: [
    "youtube music watch history",
    "youtube vs youtube music analytics",
    "takeout youtube music split",
    "music vs video listening habits"
  ]
});

export default function VideoAndMusicSplitPage() {
  const jsonLd = softwareAppJsonLd(
    "YouTube and YouTube Music split analytics",
    "Filter Takeout watch history between standard YouTube and YouTube Music inside ViewPulse.",
    "Video versus music consumption from one export"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="YouTube vs YouTube Music"
      lead="Many people split attention between long-form video and music streaming. If your Takeout file contains both, ViewPulse can separate them so you see each lane clearly."
      bullets={[
        "Toggle All / YouTube / YouTube Music when the export includes both source types",
        "Keep a single date brush so comparisons stay aligned to the same calendar window",
        "See how channel and title patterns differ between music sessions and video sessions",
        "All filtering still happens client-side on the parsed events"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Why the split matters</h2>
      <p>
        “Time on YouTube” in the abstract mixes passive listening with active watching. Separating the two
        helps you interpret totals fairly — especially if you use YouTube Music as a background audio source.
      </p>
      <h2>Export completeness</h2>
      <p>
        What you see is only as complete as your Takeout slice. If you omitted Music from the export, the
        music filter will have little or nothing to show. Include both products in Takeout when you want this
        comparison.
      </p>
    </UseCasePage>
  );
}
