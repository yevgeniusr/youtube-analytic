import { NextResponse } from 'next/server';

export const runtime = 'edge';

const TARGETS = {
  'chat.completions': 'https://api.openai.com/v1/chat/completions',
  'images.generations': 'https://api.openai.com/v1/images/generations',
} as const;

type Action = keyof typeof TARGETS;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: { message: 'Invalid JSON body' } }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: { message: 'Expected JSON object' } }, { status: 400 });
  }

  const action = body.action as string | undefined;
  const apiKey = body.apiKey as string | undefined;
  const payload = body.payload;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.length < 8) {
    return NextResponse.json({ error: { message: 'Missing or invalid apiKey' } }, { status: 400 });
  }

  if (action !== 'chat.completions' && action !== 'images.generations') {
    return NextResponse.json({ error: { message: 'Unsupported action' } }, { status: 400 });
  }

  if (payload === undefined || payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: { message: 'payload must be a JSON object' } }, { status: 400 });
  }

  const url = TARGETS[action as Action];
  const upstream = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const text = await upstream.text();
  const ct = upstream.headers.get('content-type') || 'application/json';

  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'Content-Type': ct,
      'Cache-Control': 'no-store',
    },
  });
}
