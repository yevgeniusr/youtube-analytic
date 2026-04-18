import Link from "next/link";
import type { ReactNode } from "react";
import { githubUrl } from "@/lib/links";

type UseCasePageProps = {
  eyebrow: string;
  title: string;
  lead: string;
  bullets: string[];
  children?: ReactNode;
};

export function UseCasePage({ eyebrow, title, lead, bullets, children }: UseCasePageProps) {
  return (
    <main className="use-cases-root page-shell">
      <header className="uc-hero" aria-labelledby="uc-page-title">
        <div className="uc-hero__decor" aria-hidden="true">
          <div className="uc-hero__texture" />
          <div className="uc-hero__glow" />
        </div>
        <div className="uc-hero__inner">
          <p className="uc-eyebrow">{eyebrow}</p>
          <h1 id="uc-page-title" className="uc-hero-title">
            {title}
          </h1>
          <p className="uc-hero-lead">{lead}</p>
          <div className="uc-hero-actions">
            <Link href="/#upload" className="btn-primary">
              Open ViewPulse — upload Takeout
            </Link>
            <Link href="/use-cases" className="btn-outline">
              All use cases
            </Link>
            <a href={githubUrl} target="_blank" rel="noreferrer" className="btn-outline">
              Source on GitHub
            </a>
          </div>
        </div>
      </header>

      <div className="uc-body">
        <div className="uc-split">
          <aside className="uc-panel uc-panel--aside" aria-labelledby="uc-capabilities">
            <h2 id="uc-capabilities" className="uc-panel-heading">
              What you can do in ViewPulse
            </h2>
            <ul className="uc-bullet-list">
              {bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
          </aside>
          <article className="uc-panel uc-panel--main uc-prose">{children}</article>
        </div>

        <footer className="uc-trust">
          <div className="uc-trust__inner">
            <h2 className="uc-trust__title">Privacy-first by design</h2>
            <p className="uc-trust__copy">
              ViewPulse parses your Google Takeout watch history in the browser. Your export is not uploaded for
              core analytics. Optional AI features only run if you add your own API keys and trigger them.
            </p>
            <div className="uc-trust__links">
              <a href={githubUrl} target="_blank" rel="noreferrer">
                Review the open-source code
              </a>
              <span className="uc-trust__dot" aria-hidden="true" />
              <a href="https://self-degree.com/" target="_blank" rel="noreferrer">
                Self Degree — ViewPulse
              </a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
