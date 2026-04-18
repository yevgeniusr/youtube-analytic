const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export type ReferenceImagePayload = {
  base64: string;
  mimeType: string;
};

export async function readReferenceImageFile(file: File): Promise<ReferenceImagePayload> {
  if (file.size > MAX_BYTES) {
    throw new Error(`Image must be under ${MAX_BYTES / (1024 * 1024)} MB.`);
  }
  const mimeType = file.type || 'image/png';
  if (!ALLOWED.has(mimeType)) {
    throw new Error('Use JPEG, PNG, WebP, or GIF.');
  }
  const base64 = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === 'string' ? r.result : '';
      const i = s.indexOf(',');
      if (i === -1 || !s.startsWith('data:')) {
        reject(new Error('Could not read image.'));
        return;
      }
      resolve(s.slice(i + 1));
    };
    r.onerror = () => reject(new Error('Could not read image.'));
    r.readAsDataURL(file);
  });
  return { base64, mimeType };
}
