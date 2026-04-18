/**
 * Default model IDs for BYOK AI in Tools.
 * Gemini: https://ai.google.dev/gemini-api/docs/models/gemini
 * OpenAI (Chat Completions): https://platform.openai.com/docs/models
 *
 * Omit deprecated Gemini 2.0 / 1.5 Flash IDs (blocked for new API keys).
 */

/** `model` path segment for `.../models/{model}:generateContent` */
export const GEMINI_TEXT_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-3.1-pro-preview',
] as const;

export const GEMINI_IMAGE_MODELS = [
  'gemini-3.1-flash-image-preview',
  'gemini-2.5-flash-image',
  'gemini-3-pro-image-preview',
] as const;

/** `model` field for `v1/chat/completions` */
export const OPENAI_TEXT_MODELS = [
  'gpt-5.4-mini',
  'gpt-5.4',
  'gpt-5.4-nano',
  'gpt-4o-mini',
  'gpt-4o',
] as const;

export type GeminiTextModelId = (typeof GEMINI_TEXT_MODELS)[number];
export type GeminiImageModelId = (typeof GEMINI_IMAGE_MODELS)[number];
export type OpenAITextModelId = (typeof OPENAI_TEXT_MODELS)[number];
