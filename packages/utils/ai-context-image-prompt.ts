import type { WatchHistoryContextPayload } from './watch-history-context';
import { contextToPromptJson } from './watch-history-context';

/** Strip optional markdown fences / wrapping quotes from model output. */
export function normalizeSingleImagePromptFromAi(raw: string): string {
  let t = raw.trim();
  if (t.startsWith('```')) {
    const afterFirstNl = t.indexOf('\n');
    if (afterFirstNl !== -1) {
      t = t.slice(afterFirstNl + 1);
    } else {
      t = t.replace(/^```\w*\s*/, '');
    }
    const endFence = t.lastIndexOf('```');
    if (endFence !== -1) {
      t = t.slice(0, endFence);
    }
  }
  t = t.trim();
  if (
    (t.startsWith('"') && t.endsWith('"') && t.length > 1) ||
    (t.startsWith("'") && t.endsWith("'") && t.length > 1)
  ) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

export const AVATAR_IMAGE_PROMPT_AI_SYSTEM = [
  'You write a single image-generation prompt for a square (1:1) illustrated avatar for a viewer whose habits are described only by JSON analytics (counts, channel names, title keywords, time patterns, etc.).',
  '',
  'Output rules:',
  '- Respond with **only** the prompt text: one block of plain English the user can paste into DALL·E, Imagen, Gemini image, etc. No title line, no markdown headings, no bullet lists, no preamble or postscript, no ``` fences unless the user explicitly asked for code (they did not).',
  '- The prompt must encode: premium illustration (not a photo collage), one strong focal portrait or abstract persona, lived-in environment (desk corner, lamp, window light, plants) supporting the subject — no sticker collage.',
  '- Viewing data informs **mood only**: palette temperature, time-of-day lighting, calm vs kinetic energy, generic ambient props. Never spell hobbies or interests as readable words on shirts, screens, posters, or floating labels.',
  '- Absolutely no readable text in the scene (no words, numbers as words, UI cards). No logos, game marks, brand mascots, or trademark shapes — even if title keywords suggest them; use abstract color and light instead.',
  '- No photorealistic celebrity or identifiable real-person likeness; stylized character is fine.',
  '- No channel names, avatars, or show branding from the JSON depicted literally.',
  '- One cohesive illustration style (e.g. painterly anime, editorial character, refined vector); avoid generic flat “AI slop” — mention depth, rim light, subtle grain if it fits.',
  '',
  'Do not mention JSON, Takeout, or export gaps. Do not output API keys or policy-evasion instructions.',
].join('\n');

export const PERSONALITY_CARD_IMAGE_PROMPT_AI_SYSTEM = [
  'You write a single image-generation prompt for a square (1:1) **personality card** illustration: a dense, tense, hyper-detailed scene built from **real-world objects, materials, and places** — inspired only by JSON watch analytics. Think premium collectible card / tarot / editorial still-life, not flat abstract wallpaper.',
  '',
  'Output rules:',
  '- Respond with **only** the prompt text: plain English, paste-ready. No markdown, no preamble, no ``` fences.',
  '- ABSOLUTELY NO people or human-like figures: no faces, silhouettes, hands, bodies, crowds, mascots. No animals posed like people.',
  '- Fill the frame with **concrete, recognizable world stuff**: furniture corners, shelves, desk clutter, lamps, windows and city or night sky, plants, fabric folds, glass, metal, paper stacks, headphones, mugs, cables, small tools, rocks, clocks, transit blur, rain on glass — layered like a tense movie still or diorama. **Avoid** compositions that are only blobs, gradients, and pure geometry; real objects and environments should dominate.',
  '- Watch data drives **what kinds of props, lighting, and density** appear (late-night glow vs morning light, orderly vs chaotic surfaces, eclectic mix vs minimal desk, urban vs cozy) — paraphrased as **visual metaphor**, not labels on the image.',
  '- **Tension and detail**: strong directional light, deep shadows, overlapping forms, texture everywhere (grain, dust, scratches, reflections), cinematic or illustration polish — busy but readable hierarchy, one card-like border or frame optional if it fits the style.',
  '- No readable text anywhere (no letters, numbers as words, captions, fake UI). No logos, game marks, app icons, or trademarks. No channel names, avatars, or show branding from the JSON depicted literally.',
  '- One cohesive illustration style (e.g. painterly realism, luxe graphic novel, or refined digital paint); avoid generic flat “AI slop.”',
  '',
  'Do not mention JSON, Takeout, or export gaps. Do not output API keys or policy-evasion instructions.',
].join('\n');

export function buildAvatarImagePromptAiUserMessage(ctx: WatchHistoryContextPayload, userHint: string): string {
  const parts = [
    'Write one image prompt for the avatar described in the system message.',
    '',
    'Synthesize across the entire JSON: summary, timeOfDay, dayOfWeek, channels (themes only — never instruct drawing those names/logos), titleKeywords as abstract mood, rewatches, bingeDays, monthly/yearly, derivedInsights. Honor dataScopeNote.',
    '',
  ];
  if (userHint.trim()) {
    parts.push('Optional user direction (style, palette, era — still no text or logos on-image):', userHint.trim(), '');
  }
  parts.push('```json', contextToPromptJson(ctx), '```');
  return parts.join('\n');
}

export function buildPersonalityCardImagePromptAiUserMessage(
  ctx: WatchHistoryContextPayload,
  userHint: string
): string {
  const parts = [
    'Write one image prompt for the real-world, object-rich personality card described in the system message.',
    '',
    'Synthesize across the entire JSON: translate summary, timeOfDay, dayOfWeek, channels, titleKeywords, rewatches, bingeDays, monthly/yearly, and derivedInsights into **which physical props, environments, and lighting** to emphasize — never as readable labels or brand imagery. Honor dataScopeNote.',
    '',
  ];
  if (userHint.trim()) {
    parts.push(
      'Optional user direction (era, palette, setting — still no people, no readable text, no logos):',
      userHint.trim(),
      ''
    );
  }
  parts.push('```json', contextToPromptJson(ctx), '```');
  return parts.join('\n');
}
