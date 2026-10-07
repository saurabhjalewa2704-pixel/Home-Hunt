export const gbp = (n: number | null | undefined) => (n == null ? "–" : "£" + Math.round(n).toLocaleString("en-GB"));

export const sqft = (n: number | null | undefined) => (n == null ? "–" : `${Math.round(n).toLocaleString("en-GB")} sq ft`);
export const sqm = (ft: number) => Math.round((ft / 10.764) * 10) / 10;
export const sqftAndSqm = (n: number | null | undefined) => (n == null ? "–" : `${Math.round(n).toLocaleString("en-GB")} sq ft (${sqm(n)} m²)`);

export const oneDp = (n: number) => (Math.round(Math.abs(n) * 10) / 10 * Math.sign(n)).toFixed(1).replace("-", "−");
export const signed1 = (n: number) => (n === 0 ? "0" : oneDp(n));
export const whole = (n: number) => String(Math.round(n));

const DAY = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short" });
const LONG = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });
const TIME = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" });

export const fmtDay = (iso: string) => DAY.format(new Date(iso)).replace(",", "");
export const fmtLongDay = (iso: string) => LONG.format(new Date(iso)).replace(",", "");
export const fmtTime = (iso: string) => TIME.format(new Date(iso));
export const fmtWhen = (iso: string) => `${fmtDay(iso)}, ${fmtTime(iso)}`;

export const dayKey = (iso: string | Date) => {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/** "Elsynge Road, Wandsworth Common, London SW18" -> street and area. */
export function splitAddress(address: string): { street: string; area: string } {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return { street: parts[0] ?? address, area: parts.slice(1).join(", ") };
}

export const uid = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

export const nowIso = () => new Date().toISOString();
