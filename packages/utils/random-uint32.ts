/** 32-bit unsigned int for seeding game RNGs (crypto when available). */
export function randomUint32(): number {
  try {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
    if (c?.getRandomValues) {
      const buf = new Uint32Array(1);
      c.getRandomValues(buf);
      return buf[0]! >>> 0;
    }
  } catch {
    /* ignore */
  }
  return (Math.floor(Math.random() * 0x1_0000_0000) >>> 0) || 1;
}

/** FNV-1a–style mix: combine several uint32-ish values into one seed. */
export function mixSeed(...parts: number[]): number {
  let h = 0x811c9dc5 >>> 0;
  for (const p of parts) {
    h ^= p >>> 0;
    h = Math.imul(h, 0x0100_0193) >>> 0;
  }
  return h >>> 0 || 1;
}
