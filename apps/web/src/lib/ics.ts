import type { Agent, Property, Viewing } from "./types";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** Fold lines to 75 octets as RFC 5545 asks, so Apple Calendar and Google Calendar both accept the file. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  for (const ch of line) {
    if (new TextEncoder().encode(cur + ch).length > 74) {
      out.push(cur);
      cur = " " + ch;
    } else cur += ch;
  }
  out.push(cur);
  return out.join("\r\n");
}

/** FR-V3: an invite with the address, the agent's phone and the listing link. */
export function viewingIcs(v: Viewing, p: Property, agent: Agent | null, now = new Date()): string {
  const start = new Date(v.starts_at);
  const end = new Date(start.getTime() + v.duration_min * 60_000);
  const desc = [
    agent ? `Agent: ${agent.name}${agent.agency ? ` (${agent.agency})` : ""}` : null,
    agent?.phone ? `Phone: ${agent.phone}` : null,
    p.listing_url ? `Listing: ${p.listing_url}` : null,
    v.notes ? `Notes: ${v.notes}` : null,
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HomeHunt//Viewings//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${v.id}@homehunt`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(`${v.kind === "second" ? "Second viewing" : v.kind === "survey" ? "Survey" : "Viewing"}: ${p.address.split(",")[0]}`)}`,
    `LOCATION:${esc(p.address + (p.postcode ? `, ${p.postcode}` : ""))}`,
    ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []),
    ...(p.listing_url ? [`URL:${p.listing_url}`] : []),
    "BEGIN:VALARM",
    "TRIGGER:-PT1H",
    "ACTION:DISPLAY",
    "DESCRIPTION:Viewing in one hour",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function downloadText(filename: string, text: string, mime = "text/calendar;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** FR-V4: flag viewings that overlap, or sit closer together than a rough travel time. */
export function clashes(viewings: Viewing[], travelMin = (a: Viewing, b: Viewing) => 15): Array<[Viewing, Viewing, "overlap" | "tight"]> {
  const booked = viewings.filter((v) => v.status === "booked").sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const out: Array<[Viewing, Viewing, "overlap" | "tight"]> = [];
  for (let i = 0; i < booked.length - 1; i++) {
    const a = booked[i];
    const b = booked[i + 1];
    const endA = new Date(a.starts_at).getTime() + a.duration_min * 60_000;
    const gap = (new Date(b.starts_at).getTime() - endA) / 60_000;
    if (gap < 0) out.push([a, b, "overlap"]);
    else if (gap < travelMin(a, b) && a.property_id !== b.property_id) out.push([a, b, "tight"]);
  }
  return out;
}
