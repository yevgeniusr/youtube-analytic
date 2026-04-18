import { NextResponse } from 'next/server';
import {
  buildYoutubeOembedUpstreamUrl,
  parseAllowedYoutubePageUrl,
  type YoutubeOembedResult,
} from '@/lib/youtube-oembed';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function pickString(v: unknown): string | undefined {
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get('url');
  if (!raw?.trim()) {
    return NextResponse.json({ error: 'Missing url' }, { status: 400 });
  }

  const safe = parseAllowedYoutubePageUrl(raw.trim());
  if (!safe) {
    return NextResponse.json({ error: 'Invalid or disallowed URL' }, { status: 400 });
  }

  const upstreamUrl = buildYoutubeOembedUpstreamUrl(safe);
  const upstream = await fetch(upstreamUrl, {
    headers: { Accept: 'application/json' },
    next: { revalidate: 86_400 },
  });

  if (!upstream.ok) {
    return NextResponse.json(
      { error: 'YouTube did not return metadata for this URL' },
      { status: upstream.status === 404 ? 404 : 502 }
    );
  }

  let json: unknown;
  try {
    json = await upstream.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON from YouTube' }, { status: 502 });
  }

  if (!isRecord(json)) {
    return NextResponse.json({ error: 'Unexpected oEmbed shape' }, { status: 502 });
  }

  const title = pickString(json.title);
  const author_name = pickString(json.author_name);
  const thumbnail_url = pickString(json.thumbnail_url);
  if (!title || !author_name || !thumbnail_url) {
    return NextResponse.json({ error: 'Incomplete oEmbed payload' }, { status: 502 });
  }

  const body: YoutubeOembedResult = {
    title,
    author_name,
    author_url: pickString(json.author_url),
    thumbnail_url,
    thumbnail_width: typeof json.thumbnail_width === 'number' ? json.thumbnail_width : undefined,
    thumbnail_height: typeof json.thumbnail_height === 'number' ? json.thumbnail_height : undefined,
  };

  return NextResponse.json(body, {
    headers: {
      'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
    },
  });
}
