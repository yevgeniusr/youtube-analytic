/** Subset of YouTube oEmbed JSON we forward to the client */
export type YoutubeOembedResult = {
  title: string;
  author_name: string;
  author_url?: string;
  thumbnail_url: string;
  thumbnail_width?: number;
  thumbnail_height?: number;
};

const OEMBED_ENDPOINT = 'https://www.youtube.com/oembed';

/** Hostnames we allow the oEmbed proxy to fetch (SSRF guard). */
export function parseAllowedYoutubePageUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return null;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
  if (u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  const allowed =
    h === 'youtu.be' ||
    h === 'youtube.com' ||
    h === 'www.youtube.com' ||
    h === 'm.youtube.com' ||
    h === 'music.youtube.com';
  if (!allowed) return null;
  return u.toString();
}

export function buildYoutubeOembedUpstreamUrl(pageUrl: string): string {
  return `${OEMBED_ENDPOINT}?format=json&url=${encodeURIComponent(pageUrl)}`;
}
