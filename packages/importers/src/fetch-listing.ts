import { ImportError, normaliseUrl, portalForHost } from "./url";

export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 3;

export interface FetchOptions {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/**
 * Fetch the one page the buyer pasted. Server-side, once, with a 10 second
 * timeout; redirects are followed only while they stay on a portal host. No
 * crawling and no background polling (FR-I1).
 */
export async function fetchListingHtml(rawUrl: string, opts: FetchOptions = {}): Promise<{ html: string; url: string }> {
  const { url: start } = normaliseUrl(rawUrl);
  const f = opts.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 10_000);
  try {
    let url = start;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const res = await f(url, {
        redirect: "manual",
        signal: ctl.signal,
        headers: { "user-agent": USER_AGENT, accept: "text/html,application/xhtml+xml", "accept-language": "en-GB,en;q=0.9" },
      });
      if (res.status >= 300 && res.status < 400) {
        const loc = res.headers.get("location");
        if (!loc) throw new ImportError("http", "The listing site sent us somewhere we couldn't follow.");
        const next = new URL(loc, url);
        if (!portalForHost(next.hostname)) throw new ImportError("blocked", "The listing site redirected us away from the listing.");
        url = next.toString();
        continue;
      }
      if (res.status === 403 || res.status === 401 || res.status === 429 || res.status === 503) {
        throw new ImportError("blocked", "The site didn't let us read this listing.");
      }
      if (!res.ok) throw new ImportError("http", `The listing site answered with an error (${res.status}).`);
      const html = await res.text();
      if (html.length > MAX_BYTES) throw new ImportError("too_large", "That page is too large to read.");
      if (/captcha|access denied|are you a robot|unusual traffic/i.test(html.slice(0, 6000)) && html.length < 30_000) {
        throw new ImportError("blocked", "The site asked for a human check, so we couldn't read this listing.");
      }
      return { html, url };
    }
    throw new ImportError("http", "Too many redirects.");
  } catch (e) {
    if (e instanceof ImportError) throw e;
    if ((e as Error)?.name === "AbortError") throw new ImportError("timeout", "The listing site took too long to answer.");
    throw new ImportError("network", "We couldn't reach the listing site.");
  } finally {
    clearTimeout(timer);
  }
}
