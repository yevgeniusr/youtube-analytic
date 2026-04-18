type OpenAIProxyAction = 'chat.completions' | 'images.generations';

async function postOpenAIProxy<T>(action: OpenAIProxyAction, apiKey: string, payload: unknown): Promise<T> {
  const res = await fetch('/api/openai-proxy', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, apiKey, payload }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(text.slice(0, 200) || 'OpenAI proxy returned non-JSON');
  }

  if (!res.ok) {
    const d = data as { error?: { message?: string }; message?: string };
    const msg = d?.error?.message || d?.message;
    throw new Error(msg || `OpenAI error (${res.status})`);
  }

  return data as T;
}

export type ChatCompletionMessage = { role: 'system' | 'user' | 'assistant'; content: string };

function chatMessageContentToString(content: unknown): string {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => {
      if (part && typeof part === 'object' && 'type' in part) {
        const p = part as { type?: string; text?: string };
        if (p.type === 'text' && typeof p.text === 'string') return p.text;
      }
      return '';
    })
    .join('')
    .trim();
}

export async function openaiChatCompletion(
  apiKey: string,
  model: string,
  messages: ChatCompletionMessage[],
  options?: { maxTokens?: number }
): Promise<string> {
  const data = await postOpenAIProxy<{
    choices?: Array<{ message?: { content?: unknown } }>;
  }>('chat.completions', apiKey, {
    model,
    messages,
    temperature: 0.65,
    max_tokens: options?.maxTokens ?? 4096,
  });

  const raw = data.choices?.[0]?.message?.content;
  const text = typeof raw === 'string' ? raw.trim() : chatMessageContentToString(raw);
  if (!text) {
    throw new Error('OpenAI returned no message content.');
  }
  return text;
}

export type OpenAIImageB64 = { b64_json?: string; url?: string };

export async function openaiCreateImages(
  apiKey: string,
  model: 'dall-e-3' | 'dall-e-2',
  prompt: string,
  n: number,
  size: '1024x1024' | '512x512' | '256x256'
): Promise<OpenAIImageB64[]> {
  if (model === 'dall-e-3') {
    const out: OpenAIImageB64[] = [];
    for (let i = 0; i < n; i++) {
      const data = await postOpenAIProxy<{ data?: OpenAIImageB64[] }>('images.generations', apiKey, {
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1024',
        response_format: 'b64_json',
      });
      const one = data.data?.[0];
      if (one) out.push(one);
    }
    return out;
  }

  const capped = Math.min(10, Math.max(1, n));
  const data = await postOpenAIProxy<{ data?: OpenAIImageB64[] }>('images.generations', apiKey, {
    model: 'dall-e-2',
    prompt,
    n: capped,
    size,
    response_format: 'b64_json',
  });
  return data.data ?? [];
}
