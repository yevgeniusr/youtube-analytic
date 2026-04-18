import Link from "next/link";
import type { CSSProperties } from "react";
import { createMetadata } from "@/lib/seo";

export const metadata = createMetadata({
  title: "Use Cases — Personal YouTube Watch History",
  description:
    "Real ways to use ViewPulse: personal analytics, wellbeing, families, YouTube vs Music, OpenClaw-style exports, agentic discovery vs the default feed, playful “know me” games, and rediscovering old watches — all processed locally in your browser.",
  path: "/use-cases",
  keywords: [
    "youtube watch history use cases",
    "google takeout youtube analysis",
    "personal youtube analytics privacy",
    "youtube music vs youtube history",
    "openclaw watch history context",
    "youtube history memory",
    "youtube algorithm alternative discovery"
  ]
});

const cases = [
  {
    href: "/use-cases/personal-watch-analytics",
    title: "Personal watch analytics",
    desc: "Rank channels, see peak hours, and explore your full timeline from a Takeout export — without uploading your file."
  },
  {
    href: "/use-cases/digital-wellbeing-insights",
    title: "Digital wellbeing & attention",
    desc: "Spot binge sessions, late-night spikes, and how your viewing volume changes over months and years."
  },
  {
    href: "/use-cases/families-caregivers",
    title: "Families & caregivers",
    desc: "Use a local export to reflect on viewing patterns together. Optional AI can draft a neutral summary when you bring your own keys."
  },
  {
    href: "/use-cases/video-and-music-split",
    title: "YouTube vs YouTube Music",
    desc: "When your Takeout includes both, filter and compare time spent on video versus music listening."
  },
  {
    href: "/use-cases/openclaw-steering",
    title: "OpenClaw steering",
    desc: "Shape AI assistants with structured USER.md-style context from your real watch patterns — optional BYOK after local parsing."
  },
  {
    href: "/use-cases/dating-know-me",
    title: "Dating: test how well you know me",
    desc: "Light quizzes and icebreakers from your history using local analytics and Games — you choose what to share."
  },
  {
    href: "/use-cases/better-memory",
    title: "Better memory",
    desc: "Brush the timeline and scan rankings to remember titles, channels, and eras you would otherwise forget."
  },
  {
    href: "/use-cases/agentic-recommendation-engine",
    title: "Agentic recommendation engine",
    desc: "Step off the engagement-optimized feed: let an AI assistant suggest channels from your real stats — you open what you choose."
  }
] as const;

export default function UseCasesIndexPage() {
  return (
    <main className="use-cases-root use-cases-index page-shell">
      <header className="uc-hero uc-hero--index" aria-labelledby="uc-index-title">
        <div className="uc-hero__decor" aria-hidden="true">
          <div className="uc-hero__texture" />
          <div className="uc-hero__glow" />
        </div>
        <div className="uc-hero__inner uc-hero__inner--index">
          <p className="uc-eyebrow">ViewPulse · field guide</p>
          <h1 id="uc-index-title" className="uc-hero-title uc-hero-title--index">
            Use <span className="uc-hero-title__accent">cases</span>
          </h1>
          <p className="uc-hero-lead">
            ViewPulse analyzes <strong>your</strong> Google Takeout YouTube watch history in the browser. These
            guides describe what that is actually good for — not generic creator SEO tools.
          </p>
          <div className="uc-hero-actions">
            <Link href="/#upload" className="btn-primary">
              Upload your export
            </Link>
            <Link href="/" className="btn-outline">
              Back to home
            </Link>
          </div>
        </div>
      </header>

      <section className="uc-catalog" aria-label="Use case guides">
        <div className="uc-catalog__header">
          <span className="uc-catalog__label">Index</span>
          <p className="uc-catalog__lede">
            Eight concrete starting points. Each opens a short guide plus the same in-app workflow on the home page.
          </p>
        </div>
        <ol className="uc-catalog__list">
          {cases.map((c, i) => (
            <li key={c.href} className="uc-catalog__item" style={{ "--uc-stagger": i } as CSSProperties}>
              <Link href={c.href} className="uc-catalog-card">
                <span className="uc-catalog-card__num" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="uc-catalog-card__body">
                  <span className="uc-catalog-card__tag">Guide</span>
                  <h2 className="uc-catalog-card__title">{c.title}</h2>
                  <p className="uc-catalog-card__desc">{c.desc}</p>
                  <span className="uc-catalog-card__cta">
                    Open guide
                    <span className="uc-catalog-card__arrow" aria-hidden="true">
                      →
                    </span>
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
