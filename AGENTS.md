# AGENTS.md

## Cursor Cloud specific instructions

**ViewPulse** is a privacy-first, client-side YouTube watch history analyzer built with Next.js 14 (App Router) and TypeScript. All data processing happens in the browser — there is no backend, database, or API.

### Services

| Service | Command | Port | Notes |
|---|---|---|---|
| Next.js dev server | `pnpm dev` | 3013 | The only service. Fully self-contained. |

### Key commands

See `package.json` scripts — standard Next.js project:
- **Dev**: `pnpm dev` (port 3013)
- **Lint**: `pnpm lint` (ESLint with `next/core-web-vitals`)
- **Build**: `pnpm build`
- **Start**: `pnpm start` (serves production build)

### Gotchas

- No lockfile ships with the repo; `pnpm install` generates one locally.
- The file parser (`lib/parser.ts`) uses `DOMParser` for HTML exports, so HTML parsing only works client-side (JSON parsing works anywhere).
- The `globals.css` file is very large (~25K lines) — avoid reading it in full.
- `Dashboard.tsx` is ~37K lines; prefer targeted searches over full reads.
