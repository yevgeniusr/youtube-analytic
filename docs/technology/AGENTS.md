# AGENTS.md — Viewpulse

## Service

| Service | Command | Port |
|---------|---------|------|
| Next.js dev server | `pnpm dev` (in apps/web) | 3013 |
| Next.js standalone | `node apps/web/.next/standalone/server.js` | 3000 |

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Language:** TypeScript
- **Package Manager:** pnpm
- **Styling:** CSS (globals.css)
- **AI:** Gemini (browser direct), OpenAI (via proxy route)

## Key Paths

```
apps/web/          ← main Next.js app
packages/
  configs/         ← brand tokens (name, colors, url)
  schemas/         ← shared TypeScript interfaces
  utils/           ← shared utilities (parsers, analytics)
  components/      ← shared React components
```

## Dev Commands

```bash
cd apps/web && pnpm dev      # dev server
cd apps/web && pnpm build   # production build
cd apps/web && pnpm start   # production server
```

## Important Files

- `lib/parser.ts` — watch history parser (JSON + HTML fallback)
- `lib/analytics.ts` — analytics computation
- `Dashboard.tsx` — main analytics dashboard
- `lib/games-progress-storage.ts` — localStorage game state

## File Parsing Gotchas

- Large Takeout HTML files may truncate under `DOMParser` — JSON preferred
- `DOMParser` is only fallback for non-standard markup
- `globals.css` is very large (~25K lines) — avoid full reads
- `Dashboard.tsx` is ~37K lines — prefer targeted searches
