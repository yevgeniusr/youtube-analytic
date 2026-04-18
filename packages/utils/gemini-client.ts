const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export type GeminiTextResult = { text: string; raw: unknown };

export type GeminiTextOptions = {
  maxOutputTokens?: number;
  temperature?: number;
};

export async function geminiGenerateText(
  apiKey: string,
  model: string,
  systemInstruction: string,
  userText: string,
  options?: GeminiTextOptions
): Promise<GeminiTextResult> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: userText }] }],
    generationConfig: {
      temperature: options?.temperature ?? 0.65,
      maxOutputTokens: options?.maxOutputTokens ?? 4096,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Gemini request failed (${res.status})`;
    throw new Error(msg);
  }

  const parts = (raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })?.candidates?.[0]
    ?.content?.parts;
  const text = parts?.map((p) => p.text ?? '').join('').trim() ?? '';
  if (!text) {
    throw new Error('Gemini returned no text. Try another model or check API access.');
  }
  return { text, raw };
}

export type GeminiImageResult = { base64: string; mimeType: string; raw: unknown };

export type GeminiReferenceImage = { base64: string; mimeType: string };

export async function geminiGenerateImage(
  apiKey: string,
  model: string,
  prompt: string,
  referenceImages?: GeminiReferenceImage[]
): Promise<GeminiImageResult> {
  const url = `${GEMINI_BASE}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const imageParts =
    referenceImages?.map((img) => ({
      inlineData: { mimeType: img.mimeType, data: img.base64 },
    })) ?? [];
  const requestParts = [...imageParts, { text: prompt }];
  const body = {
    contents: [
      {
        role: 'user',
        parts: requestParts,
      },
    ],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const raw = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (raw as { error?: { message?: string } })?.error?.message ||
      `Gemini image request failed (${res.status})`;
    throw new Error(msg);
  }

  const parts = (raw as {
    candidates?: Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>;
  })?.candidates?.[0]?.content?.parts;

  for (const p of parts ?? []) {
    const data = p.inlineData?.data;
    const mimeType = p.inlineData?.mimeType ?? 'image/png';
    if (data) {
      return { base64: data, mimeType, raw };
    }
  }

  throw new Error(
    'Gemini returned no image. Try gemini-3.1-flash-image-preview, gemini-2.5-flash-image, or another image-capable model.'
  );
}
