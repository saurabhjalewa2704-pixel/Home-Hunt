import sharp from "sharp";
import { serviceSupabase } from "./auth";
import { fetchPublicImage } from "./ssrf";

export interface StoredCover {
  /** What the app stores on the property: a data URL (demo) or `storage:` path (Supabase). */
  cover: string;
}

/**
 * FR-I3: keep a copy so the card still shows if the listing disappears.
 * A 400 px thumbnail is always returned. With Supabase configured, a 1600 px
 * copy and the thumbnail go to the private `listing-images` bucket.
 */
export async function storeCover(imageUrl: string, householdId: string | null): Promise<StoredCover | null> {
  const buf = await fetchPublicImage(imageUrl);
  if (!buf) return null;
  try {
    const base = sharp(buf, { failOn: "none" }).rotate();
    const [large, thumb] = await Promise.all([
      base.clone().resize({ width: 1600, withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer(),
      base.clone().resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer(),
    ]);
    const sb = householdId ? serviceSupabase() : null;
    if (sb && householdId) {
      const key = `${householdId}/${crypto.randomUUID()}`;
      const [a, b] = await Promise.all([
        sb.storage.from("listing-images").upload(`${key}-1600.jpg`, large, { contentType: "image/jpeg" }),
        sb.storage.from("listing-images").upload(`${key}-400.jpg`, thumb, { contentType: "image/jpeg" }),
      ]);
      if (!a.error && !b.error) return { cover: `storage:${key}-400.jpg` };
    }
    return { cover: `data:image/jpeg;base64,${thumb.toString("base64")}` };
  } catch {
    return null;
  }
}
