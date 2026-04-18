export interface WatchEvent {
  title: string;
  videoId?: string;
  channelName: string;
  channelUrl?: string;
  watchedAt: Date;
  source: 'youtube' | 'youtube-music';
}

/**
 * Used when Google Takeout only includes the video link (no channel anchor / subtitle).
 * This is present for ~10%+ of rows in many HTML exports — not a parser miss.
 */
export const CHANNEL_OMITTED_IN_EXPORT = 'No channel in Takeout' as const;

const MIN_VALID_WATCH_DATE = new Date('2005-01-01T00:00:00.000Z');

function getMaxValidWatchDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d;
}

function isValidWatchDate(value: Date): boolean {
  const time = value.getTime();
  if (Number.isNaN(time)) return false;
  return time >= MIN_VALID_WATCH_DATE.getTime() && time <= getMaxValidWatchDate().getTime();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

/** youtube.com/watch, music.youtube.com/watch, youtu.be, Shorts */
function extractVideoId(href: string): string | undefined {
  const v = href.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (v) return v[1];
  const short = href.match(/\/shorts\/([a-zA-Z0-9_-]{11})(?:\?|$|\/)/);
  if (short) return short[1];
  const be = href.match(/youtu\.be\/([a-zA-Z0-9_-]{11})(?:\?|$|\/)/);
  if (be) return be[1];
  return undefined;
}

function isVideoHref(href: string): boolean {
  const h = href.toLowerCase();
  if (h.includes('music.youtube.com/watch')) return true;
  if (h.includes('youtu.be/')) return true;
  if (h.includes('youtube.com/shorts/')) return true;
  if (h.includes('youtube.com/watch') && /[?&]v=[a-z0-9_-]{11}/i.test(href)) return true;
  return false;
}

function isChannelHref(href: string): boolean {
  return (
    /youtube\.com\/(channel\/|user\/|c\/)/i.test(href) ||
    /youtube\.com\/@[^/]+/i.test(href)
  );
}

/**
 * Takeout order is usually [video, channel]. Some rows only link the video; others
 * insert extra links so the second anchor is not the channel.
 */
function pickVideoAndChannel(links: Array<{ href: string; text: string }>): {
  video: { href: string; text: string };
  channelName: string;
  channelUrl?: string;
} | null {
  if (links.length === 0) return null;
  let vi = links.findIndex((l) => isVideoHref(l.href));
  if (vi < 0) vi = 0;
  const video = links[vi];
  if (!video.text.trim()) return null;
  const rest = links.slice(vi + 1);
  if (rest.length === 0) {
    return { video, channelName: CHANNEL_OMITTED_IN_EXPORT, channelUrl: undefined };
  }
  const ch =
    rest.find((l) => isChannelHref(l.href)) ?? rest[0];
  const rawCh = ch.text?.trim() ?? '';
  const channelName =
    rawCh ||
    (ch.href ? channelLabelFromUrl(ch.href) : undefined) ||
    (isChannelHref(ch.href) ? 'Unknown channel' : CHANNEL_OMITTED_IN_EXPORT);
  const channelUrl = ch.href;
  return { video, channelName, channelUrl };
}

function parseAnchorTags(fragment: string): Array<{ href: string; text: string }> {
  const out: Array<{ href: string; text: string }> = [];
  const re = /<a\s+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) !== null) {
    const href = decodeHtmlEntities(m[1]).replace(/&amp;/g, '&');
    const text = decodeHtmlEntities(stripHtmlTags(m[2])).trim();
    out.push({ href, text });
  }
  return out;
}

function normalizeTakeoutDateLine(line: string): string {
  return line
    .replace(/\u202f/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+[A-Z]{2,5}$/, '')
    .trim();
}

/** Takeout body lines are: title, channel, then "Mon d, yyyy, …" (e.g. Mar 17, 2026, 4:58:58 PM GMT+08:00) */
const TAKEOUT_DATE_LINE = /^[A-Z][a-z]{2,8}\s+\d{1,2},\s+\d{4}/;

function pickWatchDateLine(lines: string[]): string | undefined {
  for (let i = lines.length - 1; i >= 0; i--) {
    const l = lines[i];
    if (TAKEOUT_DATE_LINE.test(l)) return l;
  }
  return lines.find((l) => /\d{4}/.test(l) && /[A-Z][a-z]{2}/.test(l));
}

/** When Takeout omits channel title text, derive a readable label from the URL */
function channelLabelFromUrl(url: string): string | undefined {
  try {
    const at = url.match(/youtube\.com\/@([^/?#]+)/i);
    if (at) return `@${decodeURIComponent(at[1])}`;
    const c = url.match(/youtube\.com\/(?:c|user)\/([^/?#]+)/i);
    if (c) return decodeURIComponent(c[1].replace(/\+/g, ' '));
    const ch = url.match(/youtube\.com\/channel\/([^/?#]+)/i);
    if (ch) {
      const id = ch[1];
      return id.length > 16 ? `Channel ${id.slice(0, 14)}…` : `Channel ${id}`;
    }
  } catch {
    return undefined;
  }
  return undefined;
}

/**
 * Google Takeout HTML is often tens of MB. Browsers build an incomplete DOM from
 * `DOMParser.parseFromString` for very large documents, so we parse the raw string.
 */
const MAIN_BODY_CELL =
  /content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1">([\s\S]*?)<div class="content-cell mdl-cell mdl-cell--6-col mdl-typography--body-1 mdl-typography--text-right"/;

function parseHTMLExportFromString(content: string): WatchEvent[] {
  const events: WatchEvent[] = [];
  const chunks = content.split(
    /<div class="outer-cell mdl-cell mdl-cell--12-col[^"]*">/gi
  );

  for (let i = 1; i < chunks.length; i++) {
    try {
      const chunk = chunks[i];
      const source: 'youtube' | 'youtube-music' = chunk.slice(0, 500).includes('YouTube Music')
        ? 'youtube-music'
        : 'youtube';

      const bodyMatch = chunk.match(MAIN_BODY_CELL);
      if (!bodyMatch) continue;
      const inner = bodyMatch[1];

      const links = parseAnchorTags(inner);
      const picked = pickVideoAndChannel(links);
      if (!picked) continue;

      const { video, channelName, channelUrl } = picked;
      const title = video.text;
      const videoId = extractVideoId(video.href);

      const plain = inner.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      const lines = plain
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const dateLine = pickWatchDateLine(lines);
      if (!dateLine) continue;

      const watchedAt = new Date(normalizeTakeoutDateLine(dateLine));
      if (!isValidWatchDate(watchedAt)) continue;

      events.push({ title, videoId, channelName, channelUrl, watchedAt, source });
    } catch {
      // Skip malformed entries
    }
  }

  return events;
}

/** Legacy path when Takeout markup differs from the usual MDL template. */
function parseHTMLExportDOM(content: string): WatchEvent[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/html');
  const cells = doc.querySelectorAll('.outer-cell');
  const events: WatchEvent[] = [];

  cells.forEach((cell) => {
    try {
      const headerText = cell.querySelector('.header-cell p')?.textContent?.trim() ?? '';
      const source: 'youtube' | 'youtube-music' = headerText.includes('Music')
        ? 'youtube-music'
        : 'youtube';

      const contentCell = cell.querySelector('.content-cell');
      if (!contentCell) return;

      const anchors = Array.from(contentCell.querySelectorAll('a'));
      if (anchors.length === 0) return;

      const linkObjs = anchors.map((a) => ({
        href: a.getAttribute('href') ?? '',
        text: a.textContent?.trim() ?? '',
      }));
      const picked = pickVideoAndChannel(linkObjs);
      if (!picked) return;

      const { video, channelName, channelUrl } = picked;
      const title = video.text;
      const videoId = extractVideoId(video.href);

      const fullText = contentCell.textContent ?? '';
      const lines = fullText.split('\n').map((s) => s.trim()).filter(Boolean);
      const dateLine = pickWatchDateLine(lines);
      if (!dateLine) return;

      const watchedAt = new Date(normalizeTakeoutDateLine(dateLine));
      if (!isValidWatchDate(watchedAt)) return;

      events.push({ title, videoId, channelName, channelUrl, watchedAt, source });
    } catch {
      // Skip malformed entries
    }
  });

  return events;
}

/**
 * Parses Google Takeout watch-history.html (string scan; works for large exports).
 * Falls back to DOMParser only if the string parser finds nothing (alternate markup).
 */
export function parseHTMLExport(content: string): WatchEvent[] {
  const fromString = parseHTMLExportFromString(content);
  if (fromString.length > 0) return fromString;
  if (typeof window === 'undefined') return [];
  return parseHTMLExportDOM(content);
}

/**
 * Parses Google Takeout watch-history.json
 * Pure JS – no browser APIs required.
 */
export function parseJSONExport(content: string): WatchEvent[] {
  let data: unknown;
  try {
    data = JSON.parse(content);
  } catch {
    return [];
  }

  if (!Array.isArray(data)) return [];

  const events: WatchEvent[] = [];

  for (const item of data) {
    try {
      if (typeof item !== 'object' || item === null) continue;
      const record = item as Record<string, unknown>;

      // Filter by activityControls
      const controls = record.activityControls;
      if (!Array.isArray(controls)) continue;
      const strs = controls as string[];
      const isYT = strs.some((c) => c.includes('YouTube watch history'));
      const isMusic = strs.some((c) => c.includes('YouTube Music watch history'));
      if (!isYT && !isMusic) continue;

      // Source detection
      const products = record.products;
      const source: 'youtube' | 'youtube-music' =
        Array.isArray(products) && (products as string[]).includes('YouTube Music')
          ? 'youtube-music'
          : 'youtube';

      // Title – strip "Watched " prefix
      let title = String(record.title ?? '').replace(/^Watched\s+/, '').trim();
      if (!title || title === 'Watched') continue;

      // videoId from titleUrl
      const titleUrl = record.titleUrl as string | undefined;
      const videoId = titleUrl ? extractVideoId(String(titleUrl)) : undefined;

      // Channel from subtitles array (often missing in JSON too)
      let channelName: string = CHANNEL_OMITTED_IN_EXPORT;
      let channelUrl: string | undefined;
      const subs = record.subtitles;
      if (Array.isArray(subs) && subs.length > 0) {
        const sub = subs[0] as Record<string, unknown>;
        const rawName = String(sub.name ?? '').trim();
        channelUrl = sub.url as string | undefined;
        channelName =
          rawName ||
          (channelUrl ? channelLabelFromUrl(channelUrl) : undefined) ||
          (channelUrl && isChannelHref(String(channelUrl)) ? 'Unknown channel' : CHANNEL_OMITTED_IN_EXPORT);
      }

      // Time (ISO 8601)
      const timeStr = record.time as string;
      if (!timeStr) continue;
      const watchedAt = new Date(timeStr);
      if (!isValidWatchDate(watchedAt)) continue;

      events.push({ title, videoId, channelName, channelUrl, watchedAt, source });
    } catch {
      // Skip malformed entries
    }
  }

  return events;
}

/** Auto-detects format from filename and parses accordingly. */
export async function parseExportFile(file: File): Promise<WatchEvent[]> {
  const content = await file.text();
  if (file.name.toLowerCase().endsWith('.json')) {
    return parseJSONExport(content);
  }
  return parseHTMLExport(content);
}
