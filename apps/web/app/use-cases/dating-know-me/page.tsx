import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "YouTube Watch History — “How Well Do You Know Me?” Icebreakers",
  description:
    "Use ViewPulse locally to turn your Takeout watch history into conversation starters and light quiz fuel — share only what you choose.",
  path: "/use-cases/dating-know-me",
  keywords: [
    "youtube watch history quiz",
    "couple icebreaker watch history",
    "know me game youtube",
    "private watch history games"
  ]
});

export default function DatingKnowMePage() {
  const jsonLd = softwareAppJsonLd(
    "Dating and social “know me” from watch history",
    "ViewPulse helps you explore YouTube watch history locally for playful quizzes and icebreakers. Optional Games tab; data stays on your device for core analytics.",
    "Watch history based conversation starters"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Dating: test how well you know me"
      lead="Turn your real watch history into playful prompts — top channels, guilty-pleasure genres, or “guess what I rewatched” — without handing a cloud app your export. Everything parses locally; you decide what to show on a second screen or read aloud."
      bullets={[
        "Load your Takeout file in the browser: rankings and timelines stay on your device for core analytics",
        "Use the Games tab for quick, history-driven challenges (for example channel or rewatch-style prompts)",
        "Pair charts with your own questions: “Which of these three did I binge last month?”",
        "Optional AI features are off by default — skip them entirely for a purely local night-in"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Consent and boundaries</h2>
      <p>
        This works best when everyone opts in. History can feel personal; treat it like a journal you choose to
        share excerpts from, not a scoreboard. If someone prefers not to play, respect that — ViewPulse does
        not require accounts or social logins, so there is no automatic sharing layer.
      </p>
      <h2>Low-pressure ideas</h2>
      <p>
        Compare only high-level stats (total time, top five channels) before diving into titles. Use wrong-answer
        rounds for laughs. The goal is curiosity and conversation, not surveillance — keep the file local and
        close the tab when you are done.
      </p>
    </UseCasePage>
  );
}
