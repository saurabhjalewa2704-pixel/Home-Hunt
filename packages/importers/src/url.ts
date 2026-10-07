import type { Portal } from "./types";

const HOSTS: Record<Portal, RegExp> = {
  rightmove: /(^|\.)rightmove\.co\.uk$/i,
  zoopla: /(^|\.)zoopla\.co\.uk$/i,
  onthemarket: /(^|\.)onthemarket\.com$/i,
};

export class ImportError extends Error {
  constructor(
    public code: "bad_url" | "unsupported_host" | "blocked" | "timeout" | "http" | "too_large" | "network",
    message: string,
  ) {
    super(message);
  }
}

export function portalForHost(host: string): Portal | null {
  for (const [p, re] of Object.entries(HOSTS) as [Portal, RegExp][]) if (re.test(host)) return p;
  return null;
}

const TRACKING = /^(utm_|fbclid|gclid|mc_|cid$|channel$|source$|ref$|referrer$|sort$|searchType$|\$)/i;

/** Validate against the allow-list of portal hosts and strip tracking parameters. */
export function normaliseUrl(input: string): { url: string; portal: Portal } {
  let u: URL;
  try {
    u = new URL(input.trim());
  } catch {
    throw new ImportError("bad_url", "That doesn't look like a web address.");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw new ImportError("bad_url", "That doesn't look like a web address.");
  const portal = portalForHost(u.hostname);
  if (!portal) {
    throw new ImportError(
      "unsupported_host",
      "We can read Rightmove, Zoopla and OnTheMarket links. For anything else, paste the listing text or enter the details yourself.",
    );
  }
  u.protocol = "https:";
  u.hash = "";
  for (const k of [...u.searchParams.keys()]) if (TRACKING.test(k)) u.searchParams.delete(k);
  return { url: u.toString(), portal };
}

export function listingIdFromUrl(url: string, portal: Portal): string | null {
  const path = new URL(url).pathname;
  switch (portal) {
    case "rightmove":
      return path.match(/\/properties\/(\d+)/)?.[1] ?? null;
    case "zoopla":
      return path.match(/\/details\/(?:[a-z-]+\/)?(\d+)/i)?.[1] ?? null;
    case "onthemarket":
      return path.match(/\/details\/([\w-]+)/)?.[1] ?? null;
  }
}
