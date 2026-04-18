'use client';

import Link from 'next/link';
import { useCallback, useRef, useState } from 'react';
import { parseExportFile, WatchEvent } from '@/lib/parser';
import { githubUrl } from '@/lib/links';
import { Dashboard } from './Dashboard';

type Phase =
  | { name: 'landing' }
  | { name: 'loading' }
  | { name: 'data'; events: WatchEvent[] }
  | { name: 'error'; message: string };

const features = [
  {
    tag: 'Timeline Analysis',
    title: 'When do you watch?',
    desc: 'Map every video to the hour, day, and month it was watched, then brush the interactive timeline to zoom from a single week to your full archive.',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    cls: 'feat-wide',
  },
  {
    tag: 'Channel Rankings',
    title: 'Your most-watched creators',
    desc: 'A full ranking of every channel by total watch count. The results are often surprising — who has really earned the most of your time?',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    cls: 'feat-narrow',
  },
  {
    tag: 'Binge Detection',
    title: 'Longest sessions',
    desc: 'Automatically surface your deepest binge sessions — the days you watched the most. Your record might surprise you.',
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    cls: 'feat-third',
  },
  {
    tag: 'Year-over-Year',
    title: 'How habits shift',
    desc: 'Track how your viewing has evolved over the years. Which years were you most active? Which channels did you outgrow?',
    icon: (
      <svg viewBox="0 0 24 24">
        <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
        <polyline points="17 6 23 6 23 12" />
      </svg>
    ),
    cls: 'feat-third',
  },
  {
    tag: 'YouTube Music',
    title: 'Streaming split',
    desc: 'Separate your YouTube watch history from YouTube Music listening. See exactly how you split your time across video and audio.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M9 18V5l12-2v13" />
        <circle cx="6" cy="18" r="3" />
        <circle cx="18" cy="16" r="3" />
      </svg>
    ),
    cls: 'feat-third',
  },
  {
    tag: 'Games',
    title: 'History quizzes',
    desc: 'Channel duel, rewatch duel, and history-check modes turn your log into quick challenges. Thumbnails load via an allowlisted oEmbed proxy — your Takeout file never hits our servers.',
    icon: (
      <svg viewBox="0 0 24 24">
        <rect x="2" y="6" width="9" height="14" rx="1.5" />
        <rect x="13" y="4" width="9" height="16" rx="1.5" />
        <path d="M5.5 11h2M6.5 10v2M16.5 12h2M17.5 11v2" />
      </svg>
    ),
    cls: 'feat-third',
  },
  {
    tag: 'Optional AI · BYOK',
    title: 'Export panel',
    desc: 'Add your own keys when you want: OpenClaw-style USER.md / context, a caregiver-oriented report, N-channel discovery recs, and image outputs (poster, prompts, cards). Gemini runs in-browser; OpenAI text/images use a minimal CORS-only proxy — no logging of keys or payloads.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
        <path d="M5 19h14" />
        <path d="M8 17v2M12 16v3M16 17v2" />
      </svg>
    ),
    cls: 'feat-third',
  },
  {
    tag: 'Field guide',
    title: 'Use-case stories',
    desc: 'Short guides for wellbeing, families, OpenClaw steering, agentic discovery off the default feed, “know me” games, and more — same upload flow, clearer intent.',
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        <line x1="8" y1="7" x2="16" y2="7" />
        <line x1="8" y1="11" x2="14" y2="11" />
      </svg>
    ),
    cls: 'feat-third',
  },
];

const steps = [
  {
    num: '01',
    title: 'Export from Google',
    desc: 'Go to takeout.google.com, select "YouTube and YouTube Music," choose history only, and download the ZIP file.',
  },
  {
    num: '02',
    title: 'Upload the file',
    desc: 'Unzip the archive and drag watch-history.html or watch-history.json onto the upload zone. Nothing is sent to any server.',
  },
  {
    num: '03',
    title: 'Explore the dashboard',
    desc: 'Brush the timeline, filter YouTube vs Music, and dig into rankings, binge signals, and year-over-year trends — all computed locally from your file.',
  },
  {
    num: '04',
    title: 'Games & optional AI',
    desc: 'Try Games for quick quizzes, or open the export panel when you want BYOK help: OpenClaw-style context, family summaries, channel recommendations, and image tools.',
  },
];

export function HomeClient() {
  const [phase, setPhase] = useState<Phase>({ name: 'landing' });
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setPhase({ name: 'loading' });
    try {
      const events = await parseExportFile(file);
      if (events.length === 0) {
        setPhase({
          name: 'error',
          message:
            'No watch history found in this file. Make sure you uploaded a watch-history.html or watch-history.json from Google Takeout.',
        });
        return;
      }
      setPhase({ name: 'data', events });
    } catch (err) {
      setPhase({ name: 'error', message: String(err) });
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  // Loading state
  if (phase.name === 'loading') {
    return (
      <div className="loading-overlay">
        <div className="loading-card">
          <div className="loading-spinner" />
          <p className="loading-title">Analyzing your history…</p>
          <p className="loading-sub">Parsing watch events and computing insights</p>
        </div>
      </div>
    );
  }

  // Dashboard state
  if (phase.name === 'data') {
    return (
      <Dashboard
        events={phase.events}
        onReset={() => setPhase({ name: 'landing' })}
      />
    );
  }

  // Landing (+ error) state
  return (
    <main className="page-shell">
      {/* Error banner */}
      {phase.name === 'error' && (
        <div className="error-banner">
          <span><strong>Error:</strong> {phase.message}</span>
          <button onClick={() => setPhase({ name: 'landing' })}>Try again</button>
        </div>
      )}

      {/* HERO */}
      <section className="hero-band">
        <div className="hero-band__decor" aria-hidden="true">
          <div className="hero-glow" />
        </div>
        <p className="hero-eyebrow">YouTube History Analytics · 100% Private</p>
        <h1>
          Decode your<br />
          <span className="txt-red">watch</span>{' '}
          <span className="txt-outline">history.</span>
        </h1>
        <p className="hero-lead">
          Drop your Takeout file: timelines, rankings, binge signals, and YouTube vs Music — all in-browser, nothing
          uploaded for core analytics. Games and AI exports are optional; no account or keys required to explore.
        </p>
        <div className="hero-actions">
          <a href="#upload" className="btn-primary">Upload Your Export</a>
          <Link href="/use-cases" className="btn-outline">
            Use cases
          </Link>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="btn-outline">View Source on GitHub →</a>
        </div>
      </section>

      {/* STATS BENTO */}
      <div className="stats-bento">
        <div className="stat-tile">
          <span className="stat-num">100<span className="accent">%</span></span>
          <p className="stat-desc">Private — runs locally in your browser</p>
        </div>
        <div className="stat-tile">
          <span className="stat-num">20<span className="accent">+</span></span>
          <p className="stat-desc">Insight dimensions analyzed</p>
        </div>
        <div className="stat-tile">
          <span className="stat-num">0</span>
          <p className="stat-desc">Server uploads required</p>
        </div>
        <div className="stat-tile">
          <span className="stat-num">∞</span>
          <p className="stat-desc">Years of history supported</p>
        </div>
      </div>

      {/* UPLOAD */}
      <section className="upload-panel" id="upload">
        <p className="panel-label">Step 1 — Start here</p>
        <h2 className="panel-title">Drop your Takeout file</h2>

        <div
          className={`upload-zone${isDragging ? ' upload-zone--drag' : ''}`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragEnter={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          role="button"
          tabIndex={0}
          aria-label="Upload watch history file"
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click(); }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".html,.json"
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
          <div className="upload-orb">
            <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4m0 0L8 8m4-4l4 4" />
              <path d="M4 20h16" />
            </svg>
          </div>
          <p className="upload-title">Drag &amp; drop your export file</p>
          <p className="upload-sub">
            Supports <strong>watch-history.html</strong> and <strong>watch-history.json</strong> from Google Takeout<br />
            Your data never leaves your device — analysis runs entirely in-browser
          </p>
          <div className="format-row">
            <span className="format-chip">watch-history.html</span>
            <span className="format-chip">watch-history.json</span>
            <span className="format-chip">Google Takeout ZIP</span>
          </div>
        </div>

        <p className="upload-note">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          Watch history is parsed in your browser for analytics — not uploaded for core insights. Games use an
          allowlisted thumbnail proxy only; optional AI runs only when you add keys and trigger it. Open source on{' '}
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>
          {' · '}
          <Link href="/use-cases">Use-case guides</Link>.
        </p>
      </section>

      {/* HOW IT WORKS */}
      <section className="how-band" id="how">
        <p className="panel-label">How it works</p>
        <h2 className="panel-title">Four steps to full insight</h2>

        <div className="steps-row">
          {steps.map((step) => (
            <div className="step-item" key={step.num}>
              <div className="step-num">{step.num}</div>
              <h3>{step.title}</h3>
              <p>{step.desc}</p>
            </div>
          ))}
        </div>
        <p className="upload-note" style={{ marginTop: '1rem' }}>
          Review the full client-side implementation on{' '}
          <a href={githubUrl} target="_blank" rel="noreferrer">GitHub</a>.
        </p>
      </section>

      {/* FEATURES */}
      <section className="feature-grid">
        {features.map((f) => (
          <div className={`feat ${f.cls}`} key={f.tag}>
            <div className="feat-icon">{f.icon}</div>
            <span className="feat-tag">{f.tag}</span>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* CTA */}
      <section className="cta-footer">
        <h2>
          Know your<br />
          <span>attention.</span>
        </h2>
        <p>Free forever · open source · analytics on your device · optional Games &amp; BYOK AI when you want them</p>
        <div className="hero-actions" style={{ justifyContent: 'center' }}>
          <a href="#upload" className="btn-primary">Analyze My History →</a>
          <Link href="/use-cases" className="btn-outline">Browse use cases</Link>
          <a href={githubUrl} target="_blank" rel="noreferrer" className="btn-outline">GitHub Repository</a>
        </div>
      </section>
    </main>
  );
}
