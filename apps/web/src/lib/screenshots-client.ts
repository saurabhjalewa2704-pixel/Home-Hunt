import { resizeImage } from "./offline";

export const MAX_SHOTS = 6;
// Vercel rejects request bodies over 4.5 MB, so the whole upload has to fit well inside that.
const BUDGET = 3_800_000;

/** Shrink pasted screenshots so the upload fits: wide enough to keep small text legible. */
export async function prepareScreenshots(blobs: Blob[]): Promise<Blob[]> {
  for (const [width, quality] of [[1600, 0.82], [1400, 0.76], [1200, 0.7], [1000, 0.65]] as const) {
    const out = await Promise.all(blobs.map((b) => resizeImage(b, width, quality)));
    if (out.reduce((n, b) => n + b.size, 0) <= BUDGET && out.every((b) => b.size <= 2_400_000)) return out;
  }
  return Promise.all(blobs.map((b) => resizeImage(b, 800, 0.6)));
}

export function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });
}
