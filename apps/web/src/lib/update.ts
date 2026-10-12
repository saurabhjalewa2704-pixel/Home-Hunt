/** Which build of the app this is, and the app's main address, both fixed when it was built. */
export interface BuildInfo {
  build: string;
  builtAt: string;
}

export const THIS_BUILD: BuildInfo = {
  build: process.env.NEXT_PUBLIC_BUILD_ID ?? "local",
  builtAt: process.env.NEXT_PUBLIC_BUILD_TIME ?? "",
};

/** The stable address of the live app (no trailing slash), or "" when this build doesn't know it. */
export const CANONICAL_URL = (process.env.NEXT_PUBLIC_CANONICAL_URL ?? "").replace(/\/+$/, "");

export type UpdateAction = "reload" | "open";

export interface UpdateDecision {
  available: boolean;
  action: UpdateAction;
  /** For "open": where to go, keeping the current page. */
  target: string | null;
}

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

/**
 * Is there a newer build than the one running, and what should we do about it?
 *  - Only a build that is newer (by build time) counts, so a preview of an older branch never nags.
 *  - If the live app lives at a different address from this page (an old deployment address, a preview),
 *    the answer is to open the live address; otherwise reload this page.
 */
export function decide(own: BuildInfo, latest: BuildInfo, here: { origin: string; path: string }, canonical: string): UpdateDecision {
  const none: UpdateDecision = { available: false, action: "reload", target: null };
  if (!latest.build || latest.build === own.build) return none;
  const newer = Date.parse(latest.builtAt) > Date.parse(own.builtAt);
  if (!newer) return none;
  const elsewhere = !!canonical && originOf(canonical) !== "" && originOf(canonical) !== here.origin;
  return elsewhere ? { available: true, action: "open", target: canonical + here.path } : { available: true, action: "reload", target: null };
}

/** The address of the live app's version endpoint. Relative when this build doesn't know the live address. */
export const versionUrl = (canonical = CANONICAL_URL) => `${canonical}/api/version`;

/** Whether this build can check at all. A local development build has nothing to compare. */
export const canCheck = (own = THIS_BUILD) => own.build !== "local" && !!own.builtAt;
