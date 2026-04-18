import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Agentic YouTube Discovery — Beyond the Default Recommendation Feed",
  description:
    "Use ViewPulse plus optional AI (BYOK) to get channel ideas from your own Takeout stats — deliberate picks instead of endless engagement-optimized home feed scrolling.",
  path: "/use-cases/agentic-recommendation-engine",
  keywords: [
    "youtube recommendation alternative",
    "ai youtube channel discovery",
    "reduce youtube algorithm scrolling",
    "watch history based recommendations"
  ]
});

export default function AgenticRecommendationEnginePage() {
  const jsonLd = softwareAppJsonLd(
    "Agentic recommendation engine for YouTube",
    "ViewPulse aggregates Google Takeout watch history locally; optional AI suggests new channels via the Recs export so viewers choose what to open next.",
    "Deliberate YouTube discovery from personal analytics"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="Agentic recommendation engine"
      lead="YouTube’s default rec stack is tuned to keep you watching. ViewPulse flips the script: your history is summarized locally, then an optional AI assistant (your keys) proposes channels to try — so you search or subscribe on purpose instead of melting into the home feed."
      bullets={[
        "Parse Takeout in the browser first; rankings and keywords become the evidence an agent uses — not raw server-side profiling by a third party",
        "Open the export panel → Recs tab to generate N channel suggestions as Markdown you can save or paste into another tool",
        "Suggestions lean toward channels you do not already dominate in your stats, so discovery feels like expansion, not a clone of yesterday’s binge",
        "BYOK only when you want AI: Gemini in-browser or OpenAI via the minimal CORS proxy; verify every name on YouTube yourself before committing time"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>What “agentic” means here</h2>
      <p>
        Not autoplay chains chosen for watch time — a model (or workflow you build around the exported Markdown)
        that answers a clear prompt: “Given my real mix of channels and title keywords, what should I try next?”
        You stay the editor: reject, tweak the count, regenerate, or hand the list to a coding agent that books
        calendar time to actually watch one pick.
      </p>
      <h2>Healthier than the feed alone</h2>
      <p>
        The feed rewards urgency. A short, explicit list rewards intention. Pair this with opening YouTube from
        search or subscriptions, muting notifications, or using wellbeing patterns from the rest of ViewPulse if
        you want fewer accidental sessions. The app does not block YouTube — it gives you another way to decide
        what deserves your attention.
      </p>
    </UseCasePage>
  );
}
