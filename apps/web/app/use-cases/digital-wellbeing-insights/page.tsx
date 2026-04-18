import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "YouTube Watch Habits & Digital Wellbeing Insights",
  description:
    "Explore binge sessions, viewing volume over time, and rhythms in your YouTube watch history with ViewPulse — processed locally.",
  path: "/use-cases/digital-wellbeing-insights",
  keywords: [
    "youtube watch habits",
    "screen time awareness",
    "binge watching patterns",
    "digital wellbeing youtube"
  ]
});

export default function DigitalWellbeingInsightsPage() {
  const jsonLd = softwareAppJsonLd(
    "Digital wellbeing insights from YouTube history",
    "ViewPulse surfaces session-style patterns and long-term trends from Google Takeout watch history.",
    "Attention and viewing rhythm analysis"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Digital wellbeing & attention"
      lead="Your watch history is a time diary. ViewPulse helps you see density, streaks, and shifts — so you can decide what you want to change, if anything."
      bullets={[
        "Compare activity across years and spot when your volume jumped or cooled off",
        "Use the interactive timeline to isolate stressful or busy periods",
        "Surface long binge-style stretches from your real watch log (not a generic app estimate)",
        "Keep everything local: no account signup and no server-side copy of your export for analytics"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>A reflective tool, not a judge</h2>
      <p>
        ViewPulse does not assign scores or block content. It shows patterns so you can interpret them in
        context — work schedules, holidays, or a new interest that pulled you down a rabbit hole.
      </p>
      <h2>Pairing with real-world goals</h2>
      <p>
        Many people combine a Takeout-based review with simple rules they choose themselves: a cutoff time,
        app limits on the phone, or swapping some passive viewing for something else. The data is there to
        inform your choices, not replace them.
      </p>
    </UseCasePage>
  );
}
