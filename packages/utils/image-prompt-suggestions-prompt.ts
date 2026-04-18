import type { WatchHistoryContextPayload } from './watch-history-context';
import { contextToPromptJson } from './watch-history-context';
import type { ShareStatId } from './share-stats-config';
import { SHARE_STAT_LABELS, buildShareStatsBulletLines } from './share-stats-config';

export type ImagePromptTargetStyle = 'general' | 'openai-imagen' | 'midjourney' | 'sd-flux';

export const IMAGE_PROMPT_SUGGESTIONS_SYSTEM_PROMPT = [
  'You are an expert art director and prompt engineer. The user message contains rich JSON: aggregated YouTube / YouTube Music watch analytics from a local app (counts, named channels, title keywords, time patterns, streaks, binge days, rewatch lists — not video transcripts).',
  '',
  'Your job:',
  '- Output **Markdown only**.',
  '- Produce **exactly** the number of image-generation prompts requested (N). Each prompt must feel **distinct** (different concept, composition, palette, or metaphor).',
  '- Ground every prompt in **patterns** from the data: translate viewing rhythm, keywords, channel mix, platform split, streaks, seasonality, and derived insights into **visual language** (light, color, texture, space, motion, symbolism). Do not dump statistics as on-image text unless the user explicitly asked for infographic-style art in their optional hint.',
  '- Each prompt should be **paste-ready** for an image model: self-contained, vivid, and specific about subject, setting, lighting, lens or render feel, materials, and mood.',
  '',
  'Safety and IP:',
  '- Do **not** instruct likeness of real people, minors, or specific YouTubers. No real channel logos, trademarked characters, or recognizable brand marks.',
  '- Channel and video **titles** in the data may inspire **themes** only — paraphrase as abstract scenes, editorial still life, surreal landscapes, or non-branded objects.',
  '- Avoid sexual content involving minors; no hate imagery.',
  '',
  'Formatting (strict):',
  '- Start with H1: # Personalized image prompts',
  '- One short disclaimer under H1: prompts are AI suggestions; users remain responsible for model policies and rights.',
  '- For each prompt 1..N: an ## heading with title, then 1–2 lines of **Intent** (what facet of the data it reflects), then a fenced code block containing **only** the prompt text to paste into an image generator.',
  '',
  'Do not mention Google Takeout, export gaps, or placeholder channel names. Do not quote raw JSON field names in the prose outside code blocks. Do not include API keys or policy-evasion instructions.',
].join('\n');

function targetStyleBlock(style: ImagePromptTargetStyle): string {
  switch (style) {
    case 'openai-imagen':
      return [
        '**Phrasing target: DALL·E / Imagen-class**',
        '- One flowing paragraph per prompt (or two short paragraphs max).',
        '- Prefer explicit lighting, camera/lens character, palette, and atmosphere.',
        '- No Midjourney-specific flags (--ar, --v, etc.).',
      ].join('\n');
    case 'midjourney':
      return [
        '**Phrasing target: Midjourney**',
        '- Dense, comma-separated descriptive tokens; optional trailing parameters like aspect (--ar 3:2) or stylize if helpful.',
        '- Avoid long essay prose; stack visual keywords.',
      ].join('\n');
    case 'sd-flux':
      return [
        '**Phrasing target: Stable Diffusion / Flux**',
        '- Comma-separated tags; optional emphasis with parentheses if the user’s toolchain supports it.',
        '- Include quality/lighting tokens where useful (e.g. volumetric light, film grain); avoid trademark names.',
      ].join('\n');
    default:
      return [
        '**Phrasing target: general**',
        '- Rich natural language usable across common image APIs.',
        '- Balance clarity with evocative detail; one primary focal idea per prompt.',
      ].join('\n');
  }
}

export function buildImagePromptSuggestionsUserMessage(
  ctx: WatchHistoryContextPayload,
  opts: {
    requestedCount: number;
    userHint: string;
    targetStyle: ImagePromptTargetStyle;
    shareHighlights: readonly ShareStatId[];
  }
): string {
  const n = Math.min(15, Math.max(2, Math.round(opts.requestedCount)));

  const parts = [
    `Generate exactly **${n}** personalized image-generation prompts.`,
    '',
    targetStyleBlock(opts.targetStyle),
    '',
    '**Synthesize across the entire JSON** (not just one field): meta and dataScopeNote for range and filters; summary; timeOfDay and dayOfWeek; channels; titleKeywords; rewatches; bingeDays; monthly and yearly; derivedInsights.',
    '',
  ];

  if (opts.shareHighlights.length > 0) {
    const lines = buildShareStatsBulletLines(ctx, new Set(opts.shareHighlights));
    const labels = opts.shareHighlights.map((id) => SHARE_STAT_LABELS[id]).join(', ');
    parts.push(
      '**Extra focus — user-selected dashboard highlights** (weight these heavily alongside the JSON; still no logos or real-person likeness):',
      `Selected: ${labels}`,
      ...lines.map((line) => `- ${line}`),
      ''
    );
  }

  if (opts.userHint.trim()) {
    parts.push('**Optional user creative direction** (honor unless unsafe):', opts.userHint.trim(), '');
  }

  parts.push('**Full analytics context (primary source):**', '```json', contextToPromptJson(ctx), '```');

  return parts.join('\n');
}
