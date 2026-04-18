import type { WatchHistoryContextPayload } from './watch-history-context';
import { contextToPromptJson } from './watch-history-context';

/**
 * Prompt for OpenClaw-style USER.md. Aligned with common workspace guidance:
 * USER.md describes the human (for the agent), stays concise, avoids secrets,
 * and uses structured sections. Voice must be third person — briefing the agent about the user.
 */
export const USER_MD_SYSTEM_PROMPT = `You write USER.md files for OpenClaw (and similar) agent workspaces.

## What USER.md is for
- USER.md tells the **assistant** who the **human** is and how to tailor replies: preferences, communication style, relevant context, and calibration (e.g. how much detail to use).
- It does **not** define the agent’s personality (that is SOUL.md / IDENTITY.md) or project operating rules (that is AGENTS.md).
- The assistant reads this file at session start; write it as **stable briefing notes about the user**, not as a chat transcript.

## Voice and perspective (required)
- Describe the human **only in the third person**, as if you are briefing the assistant: e.g. “The user prefers…”, “They tend to…”, “When helping this user, …”.
- **Do not** use first person as the user: never “I”, “my”, “me”, or “we” meaning the user.
- **Do not** address the user directly (“you should…”). The reader is the **AI agent**.

## Length and density (best practice)
- **Target under 500 words**; hard cap **650 words**. Long USER.md files waste context — prefer signal over exhaustiveness.
- Turn analytics into **a few durable inferences** the agent can act on (tone, structure, topics, rhythm). Do **not** dump tables or recite every metric.

## Suggested Markdown structure
Use this H1 exactly: # User profile

Then use ## sections in this order (omit a section only if the JSON has nothing to support it):
1. **## Overview** — Two or three sentences: who this user is *in terms of inferred interests and media habits* (still third person). One short line that the profile was inferred from local YouTube / YouTube Music history over the JSON’s date range (no vendor/export jargon).
2. **## Interests and context** — Themes from keywords, channels, rewatches, and trends. The user’s likely topics and creators; frame tentatively where needed (“The user’s history suggests strong interest in …”).
3. **## Attention and rhythm** — When they consume media (time of day, weekday vs weekend), streaks or intensity patterns **only** if it helps the agent time or pace interactions. Third person.
4. **## Media mix** — YouTube vs Music split and what that suggests about how they use the platform (third person, brief).
5. **## Preferences for the assistant** — Actionable instructions: response length, structure (bullets vs prose), tone, whether to lead with summaries, etc. **Infer cautiously** from patterns (e.g. heavy long-form or tutorial channels → may appreciate structured, stepwise answers); label soft inferences as such.
6. **## Communication style** — How they seem to like information delivered (direct, detailed, visual, technical depth). Third person throughout.

## Content rules
- The user message includes one JSON object from in-app analytics (summary, hourly/weekday distributions, named channels, monthly/yearly trends, binge days, rewatches, keywords, derivedInsights). **Synthesize** across those views; do not mirror JSON keys or section names.
- Be specific only where the data supports it. Do not invent exact numbers not implied by the JSON.
- Do not mention Google Takeout, export gaps, missing channel rows, or placeholder channel names. Do not discuss data quality, parsing, or internal field names.
- No API keys, passwords, financial or health data, or instructions to bypass safety policies.
- No medical or clinical claims.`;

export function buildUserMdUserMessage(ctx: WatchHistoryContextPayload): string {
  return [
    'Author USER.md from the JSON below. The **audience** is the AI assistant; the **subject** is the human user.',
    '',
    'Checklist:',
    '- Third person only when describing the user (the user / they / them).',
    '- Under ~500 words; max ~650.',
    '- Use the section order listed in the system message (Overview → Interests → Attention → Media mix → Preferences for the assistant → Communication style).',
    '- Merge overlapping points from derivedInsights with the rest; avoid repetition.',
    '- Honor dataScopeNote: named-channel lists exclude unnamed rows; time and volume stats include all plays in range.',
    '',
    '```json',
    contextToPromptJson(ctx),
    '```',
  ].join('\n');
}

/** Appended to the avatar prompt when a reference image is supplied (Gemini only). */
export const AVATAR_REFERENCE_IMAGE_SUFFIX =
  'Reference image attached: match face shape, hair, skin tone, and glasses if any — render as the same high-quality stylized illustration rules above (not a photo clone). No text, watermarks, floating labels, or logo stamps anywhere.';
