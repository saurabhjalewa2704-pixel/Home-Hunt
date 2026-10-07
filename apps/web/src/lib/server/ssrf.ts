import { lookup } from "node:dns/promises";
import net from "node:net";

function privateV4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
  );
}
function privateV6(ip: string): boolean {
  const s = ip.toLowerCase();
  if (s === "::1" || s === "::") return true;
  if (s.startsWith("fe8") || s.startsWith("fe9") || s.startsWith("fea") || s.startsWith("feb") || s.startsWith("fc") || s.startsWith("fd")) return true;
  const m = s.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return m ? privateV4(m[1]) : false;
}

/** True only when the host resolves exclusively to public addresses. */
export async function isPublicHost(host: string): Promise<boolean> {
  if (net.isIP(host)) return net.isIPv4(host) ? !privateV4(host) : !privateV6(host);
  try {
    const addrs = await lookup(host, { all: true });
    return addrs.length > 0 && addrs.every((a) => (a.family === 4 ? !privateV4(a.address) : !privateV6(a.address)));
  } catch {
    return false;
  }
}

/** Fetch a remote image safely: https only, public hosts only, no redirects, size and time limits. */
export async function fetchPublicImage(url: string, maxBytes = 8_000_000, timeoutMs = 8000): Promise<Buffer | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !(await isPublicHost(u.hostname))) return null;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(u, { redirect: "manual", signal: ctl.signal, headers: { accept: "image/*" } });
    if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > maxBytes) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > maxBytes ? null : buf;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
