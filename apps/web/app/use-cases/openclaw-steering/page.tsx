import { UseCasePage } from "@/components/use-case-page";
import { createMetadata, softwareAppJsonLd } from "@/lib/seo";

export const metadata = createMetadata({
  title: "OpenClaw-Style AI Context from YouTube Watch History",
  description:
    "Use ViewPulse’s export panel to generate USER.md and CONTEXT.json-style context from your Takeout watch history — optional BYOK, processed locally first.",
  path: "/use-cases/openclaw-steering",
  keywords: [
    "openclaw user md",
    "ai agent context youtube",
    "watch history context file",
    "local youtube analytics export"
  ]
});

export default function OpenclawSteeringPage() {
  const jsonLd = softwareAppJsonLd(
    "OpenClaw-style steering from watch history",
    "ViewPulse builds structured context from Google Takeout watch history for OpenClaw-style workspaces. Optional AI with your own keys.",
    "USER.md and context export for AI assistants"
  );

  return (
    <UseCasePage
      eyebrow="USE CASE"
      title="OpenClaw steering"
      lead="Give an AI assistant grounded, first-party signal about what you actually watch — not a vague profile. ViewPulse summarizes your Takeout history locally, then optional BYOK steps can format it for OpenClaw-style workspaces (USER.md and CONTEXT.json patterns)."
      bullets={[
        "Parse watch-history.html or watch-history.json entirely in the browser before any optional AI step",
        "Open the export panel → OpenClaw tab to generate an AI-oriented USER.md-style file plus companion context",
        "Steer recommendations, planning, and tone: your agent can reason about real channels, genres, and rhythms",
        "Keys stay yours: Gemini runs in the browser; OpenAI text goes through the minimal CORS proxy without server-side logging of keys or payloads"
      ]}
    >
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h2>Why watch history matters for agents</h2>
      <p>
        Generic assistants guess. A structured snapshot of your viewing diet — top channels, time patterns, and
        long-arc trends — makes answers about habits, interests, and “what should I watch less of?” far more
        specific. You remain in control of what gets copied out of the app.
      </p>
      <h2>Workflow</h2>
      <p>
        Upload your export on the home page, explore the dashboard, then open the export panel when you are
        ready. Trigger the OpenClaw-oriented export only if you have enabled optional AI and want that
        formatted bundle. Nothing in core analytics requires an API key.
      </p>
    </UseCasePage>
  );
}
