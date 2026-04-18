'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import type { WatchHistoryContextPayload } from '@/lib/watch-history-context';
import { contextToPromptJson } from '@/lib/watch-history-context';
import {
  PARENT_ANALYTIC_SYSTEM_PROMPT,
  buildParentAnalyticUserMessage,
} from '@/lib/parent-analytic-prompt';
import {
  CHANNEL_RECOMMENDATIONS_SYSTEM_PROMPT,
  buildChannelRecommendationsUserMessage,
} from '@/lib/channel-recommendations-prompt';
import {
  IMAGE_PROMPT_SUGGESTIONS_SYSTEM_PROMPT,
  buildImagePromptSuggestionsUserMessage,
  type ImagePromptTargetStyle,
} from '@/lib/image-prompt-suggestions-prompt';
import {
  AVATAR_IMAGE_PROMPT_AI_SYSTEM,
  PERSONALITY_CARD_IMAGE_PROMPT_AI_SYSTEM,
  buildAvatarImagePromptAiUserMessage,
  buildPersonalityCardImagePromptAiUserMessage,
  normalizeSingleImagePromptFromAi,
} from '@/lib/ai-context-image-prompt';
import {
  USER_MD_SYSTEM_PROMPT,
  AVATAR_REFERENCE_IMAGE_SUFFIX,
  buildUserMdUserMessage,
} from '@/lib/openclaw-user-md';
import { AiMarkdownPreview } from '@/components/AiMarkdownPreview';
import {
  GEMINI_IMAGE_MODELS,
  GEMINI_TEXT_MODELS,
  OPENAI_TEXT_MODELS,
} from '@/lib/ai-model-catalog';
import { geminiGenerateImage, geminiGenerateText } from '@/lib/gemini-client';
import { readReferenceImageFile } from '@/lib/reference-image';
import { openaiChatCompletion, openaiCreateImages } from '@/lib/openai-proxy-client';
import { downloadBase64Image, downloadTextFile } from '@/lib/download-file';
import { buildAiSharePosterPrompt, type ShareStatId } from '@/lib/share-stats-config';
import { ShareHighlightPicker } from '@/components/ShareHighlightPicker';
import { ImagePreviewLightbox } from '@/components/ImagePreviewLightbox';

const LS_OPENAI = 'viewpulse_byok_openai';
const LS_GEMINI = 'viewpulse_byok_gemini';

type Provider = 'openai' | 'gemini';

type GalleryImage = { id: string; src: string; mime: string; provider: Provider };
type AvatarVariant = GalleryImage;

type ReferenceUpload = { base64: string; mimeType: string; previewUrl: string };

function randomId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export type AiExportPage = 'openclaw' | 'parents' | 'recs' | 'imageReports';

export function DashboardAiExports({
  context,
  shareHighlights,
  onToggleShareHighlight,
  page,
}: {
  context: WatchHistoryContextPayload;
  shareHighlights: ShareStatId[];
  onToggleShareHighlight: (id: ShareStatId) => void;
  page: AiExportPage;
}) {
  const baseId = useId();
  const [provider, setProvider] = useState<Provider>('gemini');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [rememberKeys, setRememberKeys] = useState(false);

  const [textModelOpenAI, setTextModelOpenAI] = useState<string>(OPENAI_TEXT_MODELS[0]);
  const [textModelGemini, setTextModelGemini] = useState<string>(GEMINI_TEXT_MODELS[0]);
  const [imageModelGemini, setImageModelGemini] = useState<string>(GEMINI_IMAGE_MODELS[0]);
  const [imageModelOpenAI, setImageModelOpenAI] = useState<'dall-e-3' | 'dall-e-2'>('dall-e-3');

  const [userMdMarkdown, setUserMdMarkdown] = useState('');
  const [userMdError, setUserMdError] = useState('');
  const [userMdBusy, setUserMdBusy] = useState(false);

  const [parentMarkdown, setParentMarkdown] = useState('');
  const [parentError, setParentError] = useState('');
  const [parentBusy, setParentBusy] = useState(false);

  const [channelRecCount, setChannelRecCount] = useState(10);
  const [channelRecMarkdown, setChannelRecMarkdown] = useState('');
  const [channelRecError, setChannelRecError] = useState('');
  const [channelRecBusy, setChannelRecBusy] = useState(false);

  const [imgPromptCount, setImgPromptCount] = useState(5);
  const [imgPromptStyle, setImgPromptStyle] = useState<ImagePromptTargetStyle>('general');
  const [imgPromptHint, setImgPromptHint] = useState('');
  const [imgPromptMarkdown, setImgPromptMarkdown] = useState('');
  const [imgPromptError, setImgPromptError] = useState('');
  const [imgPromptBusy, setImgPromptBusy] = useState(false);

  const [avatarHint, setAvatarHint] = useState('');
  const [avatarVariants, setAvatarVariants] = useState(2);
  const [avatarImages, setAvatarImages] = useState<AvatarVariant[]>([]);
  const [avatarError, setAvatarError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [personalityHint, setPersonalityHint] = useState('');
  const [personalityVariants, setPersonalityVariants] = useState(2);
  const [personalityImages, setPersonalityImages] = useState<GalleryImage[]>([]);
  const [personalityError, setPersonalityError] = useState('');
  const [personalityBusy, setPersonalityBusy] = useState(false);

  const [posterAspect, setPosterAspect] = useState<'1x1' | '4x5' | '9x16'>('4x5');
  const [posterVariantCount, setPosterVariantCount] = useState(1);
  const [posterBusy, setPosterBusy] = useState(false);
  const [posterError, setPosterError] = useState('');
  const [posterImages, setPosterImages] = useState<GalleryImage[]>([]);
  const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);

  const [reference, setReference] = useState<ReferenceUpload | null>(null);
  const [refUseAvatar, setRefUseAvatar] = useState(true);
  const [refUsePoster, setRefUsePoster] = useState(false);
  const [refFileError, setRefFileError] = useState('');

  useEffect(() => {
    return () => {
      if (reference) URL.revokeObjectURL(reference.previewUrl);
    };
  }, [reference]);

  useEffect(() => {
    try {
      const o = localStorage.getItem(LS_OPENAI);
      const g = localStorage.getItem(LS_GEMINI);
      if (o) {
        setOpenaiKey(o);
        setRememberKeys(true);
      }
      if (g) {
        setGeminiKey(g);
        setRememberKeys(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!rememberKeys) return;
    try {
      if (openaiKey) localStorage.setItem(LS_OPENAI, openaiKey);
      else localStorage.removeItem(LS_OPENAI);
      if (geminiKey) localStorage.setItem(LS_GEMINI, geminiKey);
      else localStorage.removeItem(LS_GEMINI);
    } catch {
      /* ignore */
    }
  }, [rememberKeys, openaiKey, geminiKey]);

  const apiKey = provider === 'openai' ? openaiKey : geminiKey;

  const contextFingerprint = useMemo(
    () =>
      `${context.meta.rangeStartIso}|${context.meta.rangeEndIso}|${context.meta.sourceFilter}|${context.summary.totalWatched}`,
    [context]
  );

  const [avatarPrompt, setAvatarPrompt] = useState('');
  const [personalityPrompt, setPersonalityPrompt] = useState('');
  const [avatarPromptAiBusy, setAvatarPromptAiBusy] = useState(false);
  const [avatarPromptAiError, setAvatarPromptAiError] = useState('');
  const [personalityPromptAiBusy, setPersonalityPromptAiBusy] = useState(false);
  const [personalityPromptAiError, setPersonalityPromptAiError] = useState('');

  useEffect(() => {
    setAvatarPrompt('');
    setPersonalityPrompt('');
    setAvatarPromptAiError('');
    setPersonalityPromptAiError('');
  }, [contextFingerprint]);

  const generateAvatarPromptWithAi = async () => {
    setAvatarPromptAiError('');
    setAvatarPromptAiBusy(true);
    try {
      const userMsg = buildAvatarImagePromptAiUserMessage(context, avatarHint);
      let text: string;
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text: t } = await geminiGenerateText(
          geminiKey.trim(),
          textModelGemini,
          AVATAR_IMAGE_PROMPT_AI_SYSTEM,
          userMsg
        );
        text = t;
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: AVATAR_IMAGE_PROMPT_AI_SYSTEM },
          { role: 'user', content: userMsg },
        ]);
      }
      const cleaned = normalizeSingleImagePromptFromAi(text);
      if (!cleaned) {
        throw new Error('The model returned an empty prompt. Try again or pick another text model.');
      }
      setAvatarPrompt(cleaned);
    } catch (e) {
      setAvatarPromptAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setAvatarPromptAiBusy(false);
    }
  };

  const generatePersonalityPromptWithAi = async () => {
    setPersonalityPromptAiError('');
    setPersonalityPromptAiBusy(true);
    try {
      const userMsg = buildPersonalityCardImagePromptAiUserMessage(context, personalityHint);
      let text: string;
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text: t } = await geminiGenerateText(
          geminiKey.trim(),
          textModelGemini,
          PERSONALITY_CARD_IMAGE_PROMPT_AI_SYSTEM,
          userMsg
        );
        text = t;
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: PERSONALITY_CARD_IMAGE_PROMPT_AI_SYSTEM },
          { role: 'user', content: userMsg },
        ]);
      }
      const cleaned = normalizeSingleImagePromptFromAi(text);
      if (!cleaned) {
        throw new Error('The model returned an empty prompt. Try again or pick another text model.');
      }
      setPersonalityPrompt(cleaned);
    } catch (e) {
      setPersonalityPromptAiError(e instanceof Error ? e.message : String(e));
    } finally {
      setPersonalityPromptAiBusy(false);
    }
  };

  const persistKeysToggle = useCallback(
    (next: boolean) => {
      setRememberKeys(next);
      if (!next) {
        try {
          localStorage.removeItem(LS_OPENAI);
          localStorage.removeItem(LS_GEMINI);
        } catch {
          /* ignore */
        }
      }
    },
    []
  );

  const generateUserMd = async () => {
    setUserMdError('');
    setUserMdBusy(true);
    setUserMdMarkdown('');
    try {
      const userMsg = buildUserMdUserMessage(context);
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text } = await geminiGenerateText(geminiKey.trim(), textModelGemini, USER_MD_SYSTEM_PROMPT, userMsg);
        setUserMdMarkdown(text);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: USER_MD_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ]);
        setUserMdMarkdown(text);
      }
    } catch (e) {
      setUserMdError(e instanceof Error ? e.message : String(e));
    } finally {
      setUserMdBusy(false);
    }
  };

  const generateParentAnalytic = async () => {
    setParentError('');
    setParentBusy(true);
    setParentMarkdown('');
    try {
      const userMsg = buildParentAnalyticUserMessage(context);
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text } = await geminiGenerateText(
          geminiKey.trim(),
          textModelGemini,
          PARENT_ANALYTIC_SYSTEM_PROMPT,
          userMsg
        );
        setParentMarkdown(text);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: PARENT_ANALYTIC_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ]);
        setParentMarkdown(text);
      }
    } catch (e) {
      setParentError(e instanceof Error ? e.message : String(e));
    } finally {
      setParentBusy(false);
    }
  };

  const generateChannelRecommendations = async () => {
    setChannelRecError('');
    setChannelRecBusy(true);
    setChannelRecMarkdown('');
    try {
      const userMsg = buildChannelRecommendationsUserMessage(context, channelRecCount);
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text } = await geminiGenerateText(
          geminiKey.trim(),
          textModelGemini,
          CHANNEL_RECOMMENDATIONS_SYSTEM_PROMPT,
          userMsg
        );
        setChannelRecMarkdown(text);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: CHANNEL_RECOMMENDATIONS_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ]);
        setChannelRecMarkdown(text);
      }
    } catch (e) {
      setChannelRecError(e instanceof Error ? e.message : String(e));
    } finally {
      setChannelRecBusy(false);
    }
  };

  const downloadContextJson = () => {
    downloadTextFile('CONTEXT.json', contextToPromptJson(context), 'application/json;charset=utf-8');
  };

  const downloadUserMd = () => {
    if (!userMdMarkdown.trim()) return;
    downloadTextFile('USER.md', userMdMarkdown, 'text/markdown;charset=utf-8');
  };

  const downloadParentReport = () => {
    if (!parentMarkdown.trim()) return;
    downloadTextFile('parent-analytics.md', parentMarkdown, 'text/markdown;charset=utf-8');
  };

  const downloadChannelRecommendations = () => {
    if (!channelRecMarkdown.trim()) return;
    downloadTextFile('channel-recommendations.md', channelRecMarkdown, 'text/markdown;charset=utf-8');
  };

  const generateImagePromptSuggestions = async () => {
    setImgPromptError('');
    setImgPromptBusy(true);
    setImgPromptMarkdown('');
    try {
      const userMsg = buildImagePromptSuggestionsUserMessage(context, {
        requestedCount: imgPromptCount,
        userHint: imgPromptHint,
        targetStyle: imgPromptStyle,
        shareHighlights,
      });
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const { text } = await geminiGenerateText(
          geminiKey.trim(),
          textModelGemini,
          IMAGE_PROMPT_SUGGESTIONS_SYSTEM_PROMPT,
          userMsg
        );
        setImgPromptMarkdown(text);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const text = await openaiChatCompletion(openaiKey.trim(), textModelOpenAI, [
          { role: 'system', content: IMAGE_PROMPT_SUGGESTIONS_SYSTEM_PROMPT },
          { role: 'user', content: userMsg },
        ]);
        setImgPromptMarkdown(text);
      }
    } catch (e) {
      setImgPromptError(e instanceof Error ? e.message : String(e));
    } finally {
      setImgPromptBusy(false);
    }
  };

  const downloadImagePromptSuggestions = () => {
    if (!imgPromptMarkdown.trim()) return;
    downloadTextFile('image-prompts.md', imgPromptMarkdown, 'text/markdown;charset=utf-8');
  };

  const onPickReferenceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    setRefFileError('');
    if (!file) return;
    try {
      const { base64, mimeType } = await readReferenceImageFile(file);
      setReference((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { base64, mimeType, previewUrl: URL.createObjectURL(file) };
      });
    } catch (err) {
      setRefFileError(err instanceof Error ? err.message : String(err));
    }
  };

  const clearReference = () => {
    setRefFileError('');
    setReference((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
  };

  const runAvatarGeneration = async () => {
    const built = avatarPrompt.trim();
    if (!built) {
      setAvatarError('Build the prompt with AI first (button above the text area).');
      return;
    }
    setAvatarError('');
    setAvatarBusy(true);
    setAvatarImages([]);
    let prompt = built;
    const sendRefAvatar = Boolean(reference && refUseAvatar && provider === 'gemini');
    if (sendRefAvatar) {
      prompt = `${prompt} ${AVATAR_REFERENCE_IMAGE_SUFFIX}`;
    }
    const avatarRefPayload =
      sendRefAvatar && reference
        ? [{ base64: reference.base64, mimeType: reference.mimeType }]
        : undefined;
    const n = Math.min(4, Math.max(1, avatarVariants));

    try {
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const results: AvatarVariant[] = [];
        for (let i = 0; i < n; i++) {
          const { base64, mimeType } = await geminiGenerateImage(
            geminiKey.trim(),
            imageModelGemini,
            `${prompt} Alternate ${i + 1} of ${n}: different pose, framing, or lighting — same premium detail and strict no-text / no-logo rules.`,
            avatarRefPayload
          );
          const src = `data:${mimeType};base64,${base64}`;
          results.push({ id: randomId(), src, mime: mimeType, provider: 'gemini' });
        }
        setAvatarImages(results);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const size = imageModelOpenAI === 'dall-e-3' ? '1024x1024' : '512x512';
        const data = await openaiCreateImages(openaiKey.trim(), imageModelOpenAI, prompt, n, size);
        const results: AvatarVariant[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item.b64_json) {
            const mime = 'image/png';
            results.push({
              id: randomId(),
              src: `data:${mime};base64,${item.b64_json}`,
              mime,
              provider: 'openai',
            });
          }
        }
        if (results.length === 0) throw new Error('No image data returned from OpenAI.');
        setAvatarImages(results);
      }
    } catch (e) {
      setAvatarError(e instanceof Error ? e.message : String(e));
    } finally {
      setAvatarBusy(false);
    }
  };

  const regenAvatar = () => {
    void runAvatarGeneration();
  };

  const downloadVariant = (v: AvatarVariant, index: number) => {
    const ext = v.mime.includes('jpeg') ? 'jpg' : 'png';
    const base64 = v.src.split(',')[1];
    if (!base64) return;
    downloadBase64Image(`avatar-${index + 1}.${ext}`, base64, v.mime);
  };

  const runPersonalityCardGeneration = async () => {
    const built = personalityPrompt.trim();
    if (!built) {
      setPersonalityError('Build the prompt with AI first (button above the text area).');
      return;
    }
    setPersonalityError('');
    setPersonalityBusy(true);
    setPersonalityImages([]);
    const prompt = built;
    const n = Math.min(4, Math.max(1, personalityVariants));

    try {
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const results: GalleryImage[] = [];
        for (let i = 0; i < n; i++) {
          const { base64, mimeType } = await geminiGenerateImage(
            geminiKey.trim(),
            imageModelGemini,
            `${prompt} Alternate ${i + 1} of ${n}: different arrangement of real-world props, space, or lighting — same premium detail, strict no-people / no-text / no-logo rules.`
          );
          results.push({
            id: randomId(),
            src: `data:${mimeType};base64,${base64}`,
            mime: mimeType,
            provider: 'gemini',
          });
        }
        setPersonalityImages(results);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const size = imageModelOpenAI === 'dall-e-3' ? '1024x1024' : '512x512';
        const data = await openaiCreateImages(openaiKey.trim(), imageModelOpenAI, prompt, n, size);
        const results: GalleryImage[] = [];
        for (let i = 0; i < data.length; i++) {
          const item = data[i];
          if (item.b64_json) {
            const mime = 'image/png';
            results.push({
              id: randomId(),
              src: `data:${mime};base64,${item.b64_json}`,
              mime,
              provider: 'openai',
            });
          }
        }
        if (results.length === 0) throw new Error('No image data returned from OpenAI.');
        setPersonalityImages(results);
      }
    } catch (e) {
      setPersonalityError(e instanceof Error ? e.message : String(e));
    } finally {
      setPersonalityBusy(false);
    }
  };

  const downloadPersonalityCard = (img: GalleryImage, index: number) => {
    const ext = img.mime.includes('jpeg') ? 'jpg' : 'png';
    const base64 = img.src.split(',')[1];
    if (!base64) return;
    downloadBase64Image(`personality-card-${index + 1}.${ext}`, base64, img.mime);
  };

  const generateAiSharePoster = async () => {
    setPosterError('');
    setPosterBusy(true);
    setPosterImages([]);
    const sendRefPoster = Boolean(reference && refUsePoster && provider === 'gemini');
    const n = Math.min(4, Math.max(1, posterVariantCount));
    const posterRefPayload =
      sendRefPoster && reference
        ? [{ base64: reference.base64, mimeType: reference.mimeType }]
        : undefined;
    try {
      if (provider === 'gemini') {
        if (!geminiKey.trim()) throw new Error('Add your Gemini API key.');
        const results: GalleryImage[] = [];
        for (let i = 0; i < n; i++) {
          const prompt = buildAiSharePosterPrompt(context, new Set(shareHighlights), posterAspect, {
            includeUserPortrait: sendRefPoster,
            variationIndex: n > 1 ? i + 1 : undefined,
            variationCount: n > 1 ? n : undefined,
          });
          const { base64, mimeType } = await geminiGenerateImage(
            geminiKey.trim(),
            imageModelGemini,
            prompt,
            posterRefPayload
          );
          results.push({
            id: randomId(),
            src: `data:${mimeType};base64,${base64}`,
            mime: mimeType,
            provider: 'gemini',
          });
        }
        setPosterImages(results);
      } else {
        if (!openaiKey.trim()) throw new Error('Add your OpenAI API key.');
        const results: GalleryImage[] = [];
        if (imageModelOpenAI === 'dall-e-3') {
          for (let i = 0; i < n; i++) {
            const p = buildAiSharePosterPrompt(context, new Set(shareHighlights), posterAspect, {
              includeUserPortrait: false,
              variationIndex: i + 1,
              variationCount: n,
            });
            const data = await openaiCreateImages(openaiKey.trim(), 'dall-e-3', p, 1, '1024x1024');
            const item = data[0];
            if (!item?.b64_json) throw new Error('OpenAI returned no image.');
            results.push({
              id: randomId(),
              src: `data:image/png;base64,${item.b64_json}`,
              mime: 'image/png',
              provider: 'openai',
            });
          }
        } else {
          const prompt = buildAiSharePosterPrompt(context, new Set(shareHighlights), posterAspect, {
            includeUserPortrait: false,
            variationIndex: n > 1 ? 1 : undefined,
            variationCount: n > 1 ? n : undefined,
          });
          const data = await openaiCreateImages(openaiKey.trim(), 'dall-e-2', prompt, n, '512x512');
          for (let i = 0; i < data.length; i++) {
            const item = data[i];
            if (item.b64_json) {
              results.push({
                id: randomId(),
                src: `data:image/png;base64,${item.b64_json}`,
                mime: 'image/png',
                provider: 'openai',
              });
            }
          }
          if (results.length === 0) throw new Error('OpenAI returned no images.');
        }
        setPosterImages(results);
      }
    } catch (e) {
      setPosterError(e instanceof Error ? e.message : String(e));
    } finally {
      setPosterBusy(false);
    }
  };

  const downloadPosterImage = (img: GalleryImage, index: number) => {
    const base64 = img.src.split(',')[1];
    if (!base64) return;
    const ext = img.mime.includes('jpeg') ? 'jpg' : 'png';
    downloadBase64Image(`viewpulse-ai-poster-${index + 1}.${ext}`, base64, img.mime);
  };

  return (
    <div className="ai-export-stack">
      <p className="ai-export-lede">
        Keys stay in your browser. OpenAI calls use a small{' '}
        <strong>ephemeral proxy</strong> on this app (your key is forwarded for the request only, not stored) because
        OpenAI&apos;s API blocks direct browser requests (CORS). Gemini runs entirely from your browser.
      </p>

      <div className="ai-export-provider-row">
        <span className="ai-export-label">Provider</span>
        <div className="ai-export-seg">
          <button type="button" className={provider === 'gemini' ? 'active' : ''} onClick={() => setProvider('gemini')}>
            Gemini
          </button>
          <button type="button" className={provider === 'openai' ? 'active' : ''} onClick={() => setProvider('openai')}>
            OpenAI
          </button>
        </div>
      </div>

      <div className="ai-export-keys">
        {provider === 'gemini' ? (
          <label className="ai-export-key-label">
            Gemini API key
            <input
              type="password"
              autoComplete="off"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIza…"
              aria-describedby={`${baseId}-key-hint`}
            />
          </label>
        ) : (
          <label className="ai-export-key-label">
            OpenAI API key
            <input
              type="password"
              autoComplete="off"
              value={openaiKey}
              onChange={(e) => setOpenaiKey(e.target.value)}
              placeholder="sk-…"
              aria-describedby={`${baseId}-key-hint`}
            />
          </label>
        )}
        <label className="ai-export-remember">
          <input type="checkbox" checked={rememberKeys} onChange={(e) => persistKeysToggle(e.target.checked)} />
          Remember on this device (localStorage)
        </label>
      </div>
      <p id={`${baseId}-key-hint`} className="ai-export-hint">
        Never share keys or commit them to git. Revoke keys if exposed.
      </p>

      <div className="ai-export-model-row ai-export-text-model-global">
        <label>
          Text model (USER.md, parents, recs, prompt ideas, avatar &amp; personality prompt writers)
          <select
            value={provider === 'gemini' ? textModelGemini : textModelOpenAI}
            onChange={(e) =>
              provider === 'gemini' ? setTextModelGemini(e.target.value) : setTextModelOpenAI(e.target.value)
            }
          >
            {(provider === 'gemini' ? GEMINI_TEXT_MODELS : OPENAI_TEXT_MODELS).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </label>
      </div>

      {page === 'openclaw' ? (
      <section className="ai-export-section">
        <h4 className="ai-export-section-title">OpenClaw · USER.md</h4>
        <p className="ai-export-section-desc">
          AI-generated personalization file for OpenClaw-style workspaces. You can also download raw analytics as{' '}
          <code>CONTEXT.json</code> without calling an API. Uses the <strong>Text model</strong> selected above.
        </p>
        <div className="ai-export-actions">
          <button type="button" className="btn-primary" disabled={userMdBusy || !apiKey.trim()} onClick={() => void generateUserMd()}>
            {userMdBusy ? 'Generating…' : 'Generate USER.md'}
          </button>
          <button type="button" className="db-reset-btn" onClick={downloadContextJson}>
            Download CONTEXT.json
          </button>
          <button type="button" className="db-reset-btn" disabled={!userMdMarkdown.trim()} onClick={downloadUserMd}>
            Download USER.md
          </button>
        </div>
        {userMdError ? <p className="ai-export-error">{userMdError}</p> : null}
        <div className="ai-export-preview-label">
          <span>Preview</span>
          <AiMarkdownPreview markdown={userMdMarkdown} aria-label="USER.md preview" />
        </div>
      </section>
      ) : page === 'parents' ? (
      <section className="ai-export-section">
        <h4 className="ai-export-section-title">Parent analytics</h4>
        <p className="ai-export-section-desc">
          AI-assisted read of this history slice for caregivers: time patterns, concentration of channels or topics,
          repeat viewing, and binge-style days — framed as conversation starters, not judgments. Uses the{' '}
          <strong>Text model</strong> selected above.
        </p>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={parentBusy || !apiKey.trim()}
            onClick={() => void generateParentAnalytic()}
          >
            {parentBusy ? 'Generating…' : 'Generate parent report'}
          </button>
          <button type="button" className="db-reset-btn" disabled={!parentMarkdown.trim()} onClick={downloadParentReport}>
            Download parent-analytics.md
          </button>
        </div>
        {parentError ? <p className="ai-export-error">{parentError}</p> : null}
        <div className="ai-export-preview-label">
          <span>Preview</span>
          <AiMarkdownPreview markdown={parentMarkdown} aria-label="Parent analytics preview" />
        </div>
      </section>
      ) : page === 'recs' ? (
      <section className="ai-export-section">
        <h4 className="ai-export-section-title">Channel recommendations</h4>
        <p className="ai-export-section-desc">
          AI-suggested YouTube channels you might like, inferred from this slice (top channels, title keywords, repeat
          watches, and time patterns). Uses the <strong>Text model</strong> above. Suggestions are not endorsements — verify on
          YouTube.
        </p>
        <div className="ai-export-model-row">
          <label>
            How many channels
            <select
              value={channelRecCount}
              onChange={(e) => setChannelRecCount(Number(e.target.value))}
              aria-label="Number of channel recommendations"
            >
              {[5, 8, 10, 12, 15, 20, 25, 30].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={channelRecBusy || !apiKey.trim()}
            onClick={() => void generateChannelRecommendations()}
          >
            {channelRecBusy ? 'Generating…' : `Recommend ${channelRecCount} channels`}
          </button>
          <button
            type="button"
            className="db-reset-btn"
            disabled={!channelRecMarkdown.trim()}
            onClick={downloadChannelRecommendations}
          >
            Download channel-recommendations.md
          </button>
        </div>
        {channelRecError ? <p className="ai-export-error">{channelRecError}</p> : null}
        <div className="ai-export-preview-label">
          <span>Preview</span>
          <AiMarkdownPreview markdown={channelRecMarkdown} aria-label="Channel recommendations preview" />
        </div>
      </section>
      ) : (
        <>
      <section className="ai-export-section ai-export-section--reference">
        <h4 className="ai-export-section-title">Reference photo (optional)</h4>
        <p className="ai-export-section-desc">
          Upload a portrait or existing avatar to steer image models. The file stays in this browser tab only (not stored on
          our servers). Reference pixels are sent only when <strong>Gemini</strong> is selected — OpenAI image APIs do not
          accept reference uploads here.
        </p>
        <div className="ai-export-reference-row">
          <label className="ai-export-reference-file">
            <span className="ai-export-label">Image</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => void onPickReferenceFile(e)}
              aria-label="Upload reference portrait or avatar"
            />
          </label>
          {reference ? (
            <div className="ai-export-reference-preview">
              <button
                type="button"
                className="ai-export-thumb-trigger"
                onClick={() => setLightbox({ src: reference.previewUrl, alt: 'Reference photo' })}
                aria-label="Preview reference photo full size"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={reference.previewUrl} alt="" width={72} height={72} />
              </button>
              <button type="button" className="db-reset-btn" onClick={clearReference}>
                Remove
              </button>
            </div>
          ) : null}
        </div>
        {refFileError ? <p className="ai-export-error">{refFileError}</p> : null}
        {reference ? (
          <div className="ai-export-reference-toggles">
            <label>
              <input type="checkbox" checked={refUseAvatar} onChange={(e) => setRefUseAvatar(e.target.checked)} />
              Use for avatar generation
            </label>
            <label>
              <input type="checkbox" checked={refUsePoster} onChange={(e) => setRefUsePoster(e.target.checked)} />
              Use for AI stats poster (include me on the graphic)
            </label>
          </div>
        ) : null}
      </section>

      <section className="ai-export-section">
        <h4 className="ai-export-section-title">AI share poster</h4>
        <p className="ai-export-section-desc">
          Choose which stats to emphasize below, then generate. The model renders an infographic-style image from your
          numbers — always verify on-image text. To add your face, upload a reference above and enable &quot;Use for AI stats
          poster&quot; (Gemini only).
        </p>
        <ShareHighlightPicker selected={shareHighlights} onToggle={onToggleShareHighlight} />
        <div className="ai-export-model-row">
          <label>
            Target shape (prompt)
            <select value={posterAspect} onChange={(e) => setPosterAspect(e.target.value as '1x1' | '4x5' | '9x16')}>
              <option value="4x5">4:5 portrait</option>
              <option value="1x1">1:1 square</option>
              <option value="9x16">9:16 tall</option>
            </select>
          </label>
          {provider === 'gemini' ? (
            <label>
              Image model
              <select value={imageModelGemini} onChange={(e) => setImageModelGemini(e.target.value)}>
                {GEMINI_IMAGE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className="ai-export-hint-inline">OpenAI images export at 1024×1024 (crop for Stories if needed).</span>
          )}
          <label>
            Variations
            <select value={posterVariantCount} onChange={(e) => setPosterVariantCount(Number(e.target.value))}>
              {[1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={posterBusy || !apiKey.trim()}
            onClick={() => void generateAiSharePoster()}
          >
            {posterBusy ? 'Generating…' : posterVariantCount > 1 ? `Generate ${posterVariantCount} posters` : 'Generate AI poster'}
          </button>
        </div>
        {posterError ? <p className="ai-export-error">{posterError}</p> : null}
        {posterImages.length > 0 ? (
          <div className="ai-export-poster-grid">
            {posterImages.map((img, i) => (
              <figure key={img.id} className="ai-export-poster-card">
                <button
                  type="button"
                  className="ai-export-thumb-trigger ai-export-thumb-trigger--poster"
                  onClick={() => setLightbox({ src: img.src, alt: `AI poster variation ${i + 1}` })}
                  aria-label={`Preview poster ${i + 1} full size`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" loading="lazy" />
                </button>
                <figcaption className="ai-export-poster-card-actions">
                  <button type="button" className="db-reset-btn" onClick={() => downloadPosterImage(img, i)}>
                    Download
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ai-export-section">
        <h4 className="ai-export-section-title">AI image prompt ideas</h4>
        <p className="ai-export-section-desc">
          Uses the <strong>Text model</strong> above. The request includes the full <code>CONTEXT.json</code> payload (range,
          volume, hourly and weekday rhythm, channels, keywords, rewatches, binge days, monthly/yearly arcs, derived
          insights). If you checked metrics under <strong>AI share poster</strong> on this tab, those values are also sent as
          explicit bullet lines so the model can stress what you care about. Optional hint steers mood, medium, or subject
          (e.g. “cinematic still, no text on image”).
        </p>
        <div className="ai-export-model-row">
          <label>
            How many prompts
            <select
              value={imgPromptCount}
              onChange={(e) => setImgPromptCount(Number(e.target.value))}
              aria-label="Number of image prompts to generate"
            >
              {[2, 3, 5, 8, 10, 12, 15].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Phrasing for
            <select
              value={imgPromptStyle}
              onChange={(e) => setImgPromptStyle(e.target.value as ImagePromptTargetStyle)}
              aria-label="Target image model phrasing"
            >
              <option value="general">Any model (prose)</option>
              <option value="openai-imagen">DALL·E / Imagen-style</option>
              <option value="midjourney">Midjourney-style</option>
              <option value="sd-flux">SD / Flux tags</option>
            </select>
          </label>
        </div>
        <label className="ai-export-key-label">
          Extra direction (optional)
          <input
            type="text"
            value={imgPromptHint}
            onChange={(e) => setImgPromptHint(e.target.value)}
            placeholder="e.g. polaroid nostalgia, isometric diorama, oil painting, no people"
            aria-describedby={`${baseId}-img-prompt-hint`}
          />
        </label>
        <p id={`${baseId}-img-prompt-hint`} className="ai-export-hint">
          Outputs Markdown with copy-paste prompt blocks — use them in the image tools below or anywhere else.
        </p>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={imgPromptBusy || !apiKey.trim()}
            onClick={() => void generateImagePromptSuggestions()}
          >
            {imgPromptBusy ? 'Generating…' : `Generate ${imgPromptCount} prompts`}
          </button>
          <button
            type="button"
            className="db-reset-btn"
            disabled={!imgPromptMarkdown.trim()}
            onClick={downloadImagePromptSuggestions}
          >
            Download image-prompts.md
          </button>
        </div>
        {imgPromptError ? <p className="ai-export-error">{imgPromptError}</p> : null}
        <div className="ai-export-preview-label">
          <span>Preview</span>
          <AiMarkdownPreview markdown={imgPromptMarkdown} aria-label="AI image prompts preview" />
        </div>
      </section>

      <section className="ai-export-section">
        <h4 className="ai-export-section-title">Personality card</h4>
        <p className="ai-export-section-desc">
          Square personality-card art: tense, hyper-detailed scenes built from <strong>real-world objects and places</strong>{' '}
          (still life, rooms, props) — not flat abstract blobs. Unlike avatars, there is <strong>no person</strong> on the card.
          Reference photos are not used. No readable text or logos. <strong>Build prompt with AI</strong> uses the{' '}
          <strong>Text model</strong> above (full <code>CONTEXT.json</code> plus optional hint); edit before generating images.
        </p>
        <div className="ai-export-model-row">
          {provider === 'gemini' ? (
            <label>
              Image model
              <select value={imageModelGemini} onChange={(e) => setImageModelGemini(e.target.value)}>
                {GEMINI_IMAGE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Image model
              <select
                value={imageModelOpenAI}
                onChange={(e) => setImageModelOpenAI(e.target.value as 'dall-e-3' | 'dall-e-2')}
              >
                <option value="dall-e-3">dall-e-3 (one request per variant)</option>
                <option value="dall-e-2">dall-e-2 (single request, up to 10 images)</option>
              </select>
            </label>
          )}
          <label>
            Variants
            <select
              value={personalityVariants}
              onChange={(e) => setPersonalityVariants(Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ai-export-hint-row">
          <label className="ai-export-key-label ai-export-key-label--grow">
            Extra style hint (optional)
            <input
              type="text"
              value={personalityHint}
              onChange={(e) => setPersonalityHint(e.target.value)}
              placeholder="e.g. art deco geometry, soft paper craft, neon void"
            />
          </label>
          <button
            type="button"
            className="btn-primary ai-export-rebuild-btn"
            disabled={personalityPromptAiBusy || !apiKey.trim()}
            onClick={() => void generatePersonalityPromptWithAi()}
          >
            {personalityPromptAiBusy ? 'Writing prompt…' : 'Build prompt with AI'}
          </button>
        </div>
        {personalityPromptAiError ? <p className="ai-export-error">{personalityPromptAiError}</p> : null}
        <label className="ai-export-key-label">
          Full image prompt (editable)
          <textarea
            className="ai-export-prompt-area"
            rows={4}
            value={personalityPrompt}
            onChange={(e) => setPersonalityPrompt(e.target.value)}
            placeholder="Run “Build prompt with AI” to fill this from your analytics (optional hint), then edit."
          />
        </label>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={
              personalityBusy || personalityPromptAiBusy || !apiKey.trim() || !personalityPrompt.trim()
            }
            onClick={() => void runPersonalityCardGeneration()}
          >
            {personalityBusy ? 'Generating…' : personalityVariants > 1 ? `Generate ${personalityVariants} cards` : 'Generate personality card'}
          </button>
          <button
            type="button"
            className="db-reset-btn"
            disabled={
              personalityBusy || personalityPromptAiBusy || !apiKey.trim() || !personalityPrompt.trim()
            }
            onClick={() => void runPersonalityCardGeneration()}
          >
            Regenerate
          </button>
        </div>
        {personalityError ? <p className="ai-export-error">{personalityError}</p> : null}
        {personalityImages.length > 0 ? (
          <div className="ai-export-avatar-grid">
            {personalityImages.map((img, i) => (
              <figure key={img.id} className="ai-export-avatar-card">
                <button
                  type="button"
                  className="ai-export-thumb-trigger ai-export-thumb-trigger--avatar"
                  onClick={() => setLightbox({ src: img.src, alt: `Personality card ${i + 1}` })}
                  aria-label={`Preview personality card ${i + 1} full size`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt="" loading="lazy" />
                </button>
                <figcaption>
                  <button type="button" className="db-reset-btn" onClick={() => downloadPersonalityCard(img, i)}>
                    Download
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </section>

      <section className="ai-export-section">
        <h4 className="ai-export-section-title">Avatar images</h4>
        <p className="ai-export-section-desc">
          Prompts favor a single cohesive portrait with ambient mood — not floating keyword labels or logos.{' '}
          <strong>Build prompt with AI</strong> uses the <strong>Text model</strong> above (full context JSON + optional
          hint); edit before generating. Avoid specific brand or game marks. Reference photo + Gemini steers likeness only.
        </p>
        <div className="ai-export-model-row">
          {provider === 'gemini' ? (
            <label>
              Image model
              <select value={imageModelGemini} onChange={(e) => setImageModelGemini(e.target.value)}>
                {GEMINI_IMAGE_MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <label>
              Image model
              <select
                value={imageModelOpenAI}
                onChange={(e) => setImageModelOpenAI(e.target.value as 'dall-e-3' | 'dall-e-2')}
              >
                <option value="dall-e-3">dall-e-3 (one request per variant)</option>
                <option value="dall-e-2">dall-e-2 (single request, up to 10 images)</option>
              </select>
            </label>
          )}
          <label>
            Variants
            <select value={avatarVariants} onChange={(e) => setAvatarVariants(Number(e.target.value))}>
              {[1, 2, 3, 4].map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="ai-export-hint-row">
          <label className="ai-export-key-label ai-export-key-label--grow">
            Extra style hint (optional)
            <input
              type="text"
              value={avatarHint}
              onChange={(e) => setAvatarHint(e.target.value)}
              placeholder="e.g. vaporwave palette, minimal line art"
            />
          </label>
          <button
            type="button"
            className="btn-primary ai-export-rebuild-btn"
            disabled={avatarPromptAiBusy || !apiKey.trim()}
            onClick={() => void generateAvatarPromptWithAi()}
          >
            {avatarPromptAiBusy ? 'Writing prompt…' : 'Build prompt with AI'}
          </button>
        </div>
        {avatarPromptAiError ? <p className="ai-export-error">{avatarPromptAiError}</p> : null}
        <label className="ai-export-key-label">
          Full image prompt (editable)
          <textarea
            className="ai-export-prompt-area"
            rows={4}
            value={avatarPrompt}
            onChange={(e) => setAvatarPrompt(e.target.value)}
            placeholder="Run “Build prompt with AI” to fill this from your analytics (optional hint), then edit."
          />
        </label>
        <div className="ai-export-actions">
          <button
            type="button"
            className="btn-primary"
            disabled={avatarBusy || avatarPromptAiBusy || !apiKey.trim() || !avatarPrompt.trim()}
            onClick={() => void runAvatarGeneration()}
          >
            {avatarBusy ? 'Generating…' : 'Generate avatars'}
          </button>
          <button
            type="button"
            className="db-reset-btn"
            disabled={avatarBusy || avatarPromptAiBusy || !apiKey.trim() || !avatarPrompt.trim()}
            onClick={regenAvatar}
          >
            Regenerate
          </button>
        </div>
        {avatarError ? <p className="ai-export-error">{avatarError}</p> : null}
        {avatarImages.length > 0 ? (
          <div className="ai-export-avatar-grid">
            {avatarImages.map((v, i) => (
              <figure key={v.id} className="ai-export-avatar-card">
                <button
                  type="button"
                  className="ai-export-thumb-trigger ai-export-thumb-trigger--avatar"
                  onClick={() => setLightbox({ src: v.src, alt: `Avatar variant ${i + 1}` })}
                  aria-label={`Preview avatar ${i + 1} full size`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={v.src} alt="" loading="lazy" />
                </button>
                <figcaption>
                  <button type="button" className="db-reset-btn" onClick={() => downloadVariant(v, i)}>
                    Download
                  </button>
                </figcaption>
              </figure>
            ))}
          </div>
        ) : null}
      </section>
        </>
      )}

      <ImagePreviewLightbox
        open={lightbox != null}
        src={lightbox?.src ?? null}
        alt={lightbox?.alt ?? 'Preview'}
        onClose={() => setLightbox(null)}
      />
    </div>
  );
}
