"use client";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { IDoc, IEdit, IShot, IWarn } from "@/components/icons";
import { Cover, Field, PageHeader, cx } from "@/components/ui";
import { gbp, sqftAndSqm, uid } from "@/lib/format";
import { resizeImage } from "@/lib/offline";
import { refreshProximity } from "@/lib/proximity-client";
import { prepareScreenshots, toDataUrl, MAX_SHOTS } from "@/lib/screenshots-client";
import { store, useStore } from "@/lib/store";
import { EMPTY, FIELDS, num, toForm, type Form } from "@/lib/fields";
import type { Property } from "@/lib/types";
import type { ImportResult, ListingDraft } from "@homehunt/importers";

type Phase = "idle" | "loading" | "preview" | "blocked" | "paste" | "manual" | "shots";
interface Shot { id: string; blob: Blob; url: string }
type Src = "fetched" | "inferred" | "missing" | "manual";

const normAddr = (a: string) => a.toLowerCase().replace(/[^a-z0-9]/g, "");

export default function AddPage() {
  const s = useStore();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [url, setUrl] = useState("");
  const [pasted, setPasted] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [edited, setEdited] = useState<Set<keyof Form>>(new Set());
  const [agent, setAgent] = useState("");
  const [newAgent, setNewAgent] = useState({ name: "", agency: "", phone: "" });
  const [status, setStatus] = useState<"shortlisted" | "viewing_booked">("shortlisted");
  const [when, setWhen] = useState("");
  const [saving, setSaving] = useState(false);
  const [shots, setShots] = useState<Shot[]>([]);
  const [shotNote, setShotNote] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState<string[]>([]);
  const shotsRef = useRef<Shot[]>([]);
  shotsRef.current = shots;

  // Screenshots can be pasted from the clipboard anywhere on the page before the details are filled in.
  const addShots = useCallback((files: File[]) => {
    const imgs = files.filter((f) => f.type.startsWith("image/"));
    if (!imgs.length) return;
    setError(null);
    setShots((cur) => {
      const room = MAX_SHOTS - cur.length;
      if (imgs.length > room) setShotNote(`You can use up to ${MAX_SHOTS} screenshots at a time.`);
      else setShotNote(null);
      return [...cur, ...imgs.slice(0, Math.max(0, room)).map((f) => ({ id: uid(), blob: f as Blob, url: URL.createObjectURL(f) }))];
    });
    setPhase("shots");
  }, []);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
      if (!files.length || ["preview", "manual", "loading"].includes(phaseRef.current)) return;
      e.preventDefault();
      addShots(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [addShots]);
  useEffect(() => () => shotsRef.current.forEach((x) => URL.revokeObjectURL(x.url)), []);
  const removeShot = (id: string) => setShots((cur) => { const g = cur.find((x) => x.id === id); if (g) URL.revokeObjectURL(g.url); return cur.filter((x) => x.id !== id); });

  async function readShots() {
    if (!shots.length) return;
    setPhase("loading");
    setError(null);
    try {
      const body = new FormData();
      (await prepareScreenshots(shots.map((x) => x.blob))).forEach((b, i) => body.append("images", b, `screenshot-${i}.jpg`));
      const res = await fetch("/api/extract-screenshots", { method: "POST", body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message ?? "We couldn't read those screenshots.";
        if (json?.error?.code === "no_key") {
          // No AI key on the server: keep the first screenshot as the picture and let them type the rest.
          setForm(EMPTY); setEdited(new Set()); setResult(null);
          setCover(await toDataUrl(await resizeImage(shots[0].blob, 600)));
          setShotNote(msg);
          return setPhase("manual");
        }
        setError(msg);
        return setPhase("shots");
      }
      const r = json.result as ImportResult;
      setResult(r);
      setForm(toForm(r.draft));
      setEdited(new Set());
      setUnreadable(json.unreadable ?? []);
      if (json.cover) { setCover(json.cover); setShotNote(null); }
      else { setCover(await toDataUrl(await resizeImage(shots[0].blob, 600))); setShotNote("We couldn't spot the main photo, so we used your first screenshot. Pick a better one below if you like."); }
      setPhase("preview");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
      setPhase("shots");
    }
  }
  const useAsPhoto = async (blob: Blob) => { setCover(await toDataUrl(await resizeImage(blob, 600))); setShotNote(null); };

  const sourceOf = (k: keyof Form): Src => {
    if (edited.has(k)) return "manual";
    const raw = result?.sources[k as keyof ListingDraft];
    if (!result) return form[k] ? "manual" : "missing";
    if (raw === "fetched" && !form[k]) return "missing";
    return (raw as Src) ?? "missing";
  };

  const counts = useMemo(() => {
    const filled = FIELDS.filter((f) => form[f.key] !== "").length;
    return { filled, total: FIELDS.length };
  }, [form]);

  const duplicate = useMemo(() => {
    const id = result?.draft.listing_id;
    const a = normAddr(form.address);
    return s.data.properties.find((p) => (id && p.listing_id === id) || (a.length > 6 && normAddr(p.address) === a));
  }, [s.data.properties, result, form.address]);

  async function call(body: { url?: string; text?: string }) {
    setPhase("loading");
    setError(null);
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "We couldn't read that listing.");
        setPhase(body.text ? "paste" : "blocked");
        return;
      }
      const r = json.result as ImportResult;
      setResult(r);
      setCover(json.cover ?? null);
      setForm(toForm(r.draft));
      setEdited(new Set());
      setPhase("preview");
    } catch {
      setError("We couldn't reach the server. Check your connection, or enter the details yourself.");
      setPhase("blocked");
    }
  }

  const onFetch = (e: FormEvent) => {
    e.preventDefault();
    if (url.trim()) void call({ url: url.trim() });
  };

  const set = (k: keyof Form, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    setEdited((e) => new Set(e).add(k));
  };

  const valid = form.address.trim() && num(form.asking_price) !== null && (num(form.asking_price) ?? 0) > 0;

  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    try {
      const d = result?.draft;
      const sources: Property["field_sources"] = {};
      for (const f of FIELDS) {
        if (form[f.key] === "") continue;
        const so = sourceOf(f.key);
        sources[f.key] = so === "manual" ? "manual" : so === "inferred" ? "inferred" : "fetched";
      }
      const existingAgent = agent && agent !== "__new" ? agent : null;
      const p = await store.createProperty(
        {
          address: form.address.trim(),
          asking_price: num(form.asking_price) ?? 0,
          price_qualifier: (form.price_qualifier || "guide") as Property["price_qualifier"],
          postcode: form.postcode.trim().toUpperCase() || null,
          property_type: form.property_type || null,
          beds: num(form.beds),
          baths: num(form.baths),
          floor_area_sqft: num(form.floor_area_sqft),
          tenure: (form.tenure || null) as Property["tenure"],
          lease_years: num(form.lease_years),
          service_charge: num(form.service_charge),
          ground_rent: num(form.ground_rent),
          council_tax_band: form.council_tax_band.trim().toUpperCase().slice(0, 1) || null,
          epc: form.epc.trim().toUpperCase().slice(0, 1) || null,
          portal: d?.portal ?? null,
          listing_url: d?.listing_url ?? (url.trim() || null),
          listing_id: d?.listing_id ?? null,
          receptions: d?.receptions ?? null,
          lat: d?.lat ?? null,
          lng: d?.lng ?? null,
          key_features: d?.key_features ?? [],
          description: d?.description ?? null,
          image_urls: d?.image_urls ?? [],
          cover_image_path: cover,
          field_sources: sources,
          default_agent_id: existingAgent,
          address_precision: /\d[A-Z]{2}$/i.test(form.postcode.trim()) || d?.lat ? "exact" : "approximate",
        },
        {
          agent: agent === "__new" && newAgent.name.trim() ? { name: newAgent.name.trim(), agency: newAgent.agency || null, phone: newAgent.phone || null } : null,
          viewingAt: status === "viewing_booked" && when ? new Date(when).toISOString() : null,
          status: status === "viewing_booked" && !when ? "shortlisted" : status,
        },
      );
      void refreshProximity(p);
      router.push(`/property/${p.id}`);
    } finally {
      setSaving(false);
    }
  }

  const startManual = () => {
    setResult(null);
    setCover(null);
    setForm(EMPTY);
    setEdited(new Set());
    setError(null);
    setPhase("manual");
  };

  const showForm = phase === "preview" || phase === "manual";

  return (
    <div className="mx-auto flex max-w-[980px] flex-col gap-6 px-4 pt-6 pb-10 md:px-10 md:pt-9">
      <PageHeader title="Add a home" />

      {!showForm && (
        <form onSubmit={onFetch} className="flex flex-wrap items-end gap-3">
          <div className="flex min-w-[260px] flex-1 flex-col gap-1.5">
            <label className="lab" htmlFor="url">Listing link from Rightmove, Zoopla or OnTheMarket</label>
            <input id="url" className="inp !min-h-[52px] !text-base" type="url" inputMode="url" placeholder="https://www.rightmove.co.uk/properties/…" value={url} onChange={(e) => setUrl(e.target.value)} autoComplete="off" disabled={phase === "loading"} />
          </div>
          <button className="btn btn-p btn-lg" type="submit" disabled={phase === "loading" || !url.trim()}>{phase === "loading" ? "Reading the listing…" : "Fetch details"}</button>
        </form>
      )}

      {phase === "loading" && (
        <div className="panel flex items-center gap-3 p-6" role="status" aria-live="polite">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden />
          <span>Reading the listing and saving a copy of the first photo. This usually takes a few seconds.</span>
        </div>
      )}

      {phase === "idle" && (
        <div className="flex flex-wrap gap-3 text-sm">
          <button className="btn btn-p" onClick={() => setPhase("shots")}><IShot width={18} height={18} />Paste screenshots</button>
          <button className="btn" onClick={() => setPhase("paste")}><IDoc width={18} height={18} />Paste the listing text</button>
          <button className="btn" onClick={startManual}><IEdit width={18} height={18} />Enter the details yourself</button>
        </div>
      )}

      {phase === "blocked" && (
        <div className="flex flex-col gap-4">
          <div role="alert" className="flex gap-3 rounded-xl border p-3.5" style={{ background: "var(--amber-bg)", borderColor: "var(--amber)", color: "var(--amber-fg)" }}>
            <IWarn width={20} height={20} className="mt-0.5 flex-none" />
            <span className="flex flex-col gap-1">
              <span className="text-[15px] font-bold">We didn't manage to read this listing</span>
              <span className="text-sm leading-5">{error} Your link is kept. Choose one of these to finish adding the home.</span>
            </span>
          </div>
          <button className="panel flex items-start gap-3.5 p-4 text-left" onClick={() => setPhase("shots")}>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><IShot /></span>
            <span className="flex flex-col gap-1"><span className="text-base font-bold">Paste screenshots of the listing</span><span className="text-sm leading-5 text-muted">Capture the photo and the details, copy, and paste here. We read the facts and keep the photo.</span></span>
          </button>
          <button className="panel flex items-start gap-3.5 p-4 text-left" onClick={() => setPhase("paste")}>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><IDoc /></span>
            <span className="flex flex-col gap-1"><span className="text-base font-bold">Paste the listing text</span><span className="text-sm leading-5 text-muted">Select all on the listing page, copy, and paste here. We pick out the price, rooms and size.</span></span>
          </button>
          <button className="panel flex items-start gap-3.5 p-4 text-left" onClick={startManual}>
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[10px]" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><IEdit /></span>
            <span className="flex flex-col gap-1"><span className="text-base font-bold">Enter the details yourself</span><span className="text-sm leading-5 text-muted">Address, price and bedrooms are enough to start. Add the rest after the viewing.</span></span>
          </button>
          <button className="btn w-fit" onClick={() => void call({ url })}>Try the link again</button>
        </div>
      )}

      {phase === "shots" && (
        <section className="panel flex flex-col gap-4 p-5" aria-label="Paste screenshots"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addShots(Array.from(e.dataTransfer.files)); }}>
          <div className="flex flex-col gap-1">
            <h2 className="m-0 text-xl font-bold">Paste screenshots of the listing</h2>
            <p className="m-0 text-sm leading-5 text-muted">On the listing page, screenshot the photo and then the price and details. Copy each to the clipboard, then press <kbd className="rounded border border-line px-1.5 py-0.5 text-[13px]">Ctrl</kbd> / <kbd className="rounded border border-line px-1.5 py-0.5 text-[13px]">⌘</kbd> + <kbd className="rounded border border-line px-1.5 py-0.5 text-[13px]">V</kbd> here. Add up to {MAX_SHOTS}, or drop files on this box.</p>
          </div>
          {error && <p role="alert" className="m-0 rounded-xl p-3 text-sm chip-danger">{error}</p>}
          {shotNote && <p role="status" className="m-0 text-sm text-muted">{shotNote}</p>}
          <div className="flex min-h-[120px] flex-wrap items-center gap-3 rounded-xl border-2 border-dashed p-3" style={{ borderColor: "var(--btn-border)" }}>
            {shots.map((x, i) => (
              <figure key={x.id} className="m-0 flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={x.url} alt={`Screenshot ${i + 1}`} className="h-28 w-40 rounded-lg border border-line object-cover object-top" />
                <button type="button" className="min-h-9 text-[13px] font-semibold text-muted underline" onClick={() => removeShot(x.id)}>Remove screenshot {i + 1}</button>
              </figure>
            ))}
            {!shots.length && <span className="text-sm text-muted">Nothing pasted yet. Press Ctrl/⌘ + V.</span>}
          </div>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-p btn-lg" disabled={!shots.length} onClick={() => void readShots()}>Read the screenshot{shots.length === 1 ? "" : "s"}</button>
            <label className="btn btn-lg cursor-pointer">Choose from files or photos<input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addShots(Array.from(e.target.files ?? [])); e.target.value = ""; }} /></label>
            <button className="btn btn-lg" onClick={() => { shots.forEach((x) => URL.revokeObjectURL(x.url)); setShots([]); setPhase("idle"); }}>Cancel</button>
          </div>
          <p className="m-0 text-[13px] text-muted">Screenshots are sent to Claude to read, and are not kept. Capture what you see on screen rather than a full-page scroll, so the text stays sharp.</p>
        </section>
      )}

      {phase === "paste" && (
        <form className="panel flex flex-col gap-3 p-5" onSubmit={(e) => { e.preventDefault(); if (pasted.trim()) void call({ text: pasted }); }}>
          {error && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <label className="lab" htmlFor="paste">Listing text</label>
          <textarea id="paste" className="inp min-h-[200px]" value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="Paste everything from the listing page here" />
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-p" type="submit" disabled={!pasted.trim()}>Find the details</button>
            <button className="btn" type="button" onClick={() => setPhase("idle")}>Back</button>
            <button className="btn" type="button" onClick={startManual}>Enter by hand instead</button>
          </div>
        </form>
      )}

      {showForm && (
        <section className="panel flex flex-col" aria-label="Check the details">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-2 px-6 py-5">
            <div className="flex flex-col gap-1">
              <h2 className="m-0 text-xl font-bold">{phase === "preview" ? "Check what we found" : "Enter the details"}</h2>
              <p className="m-0 text-sm text-muted">{counts.filled} of {counts.total} details filled in. Nothing is saved until you choose Save home.</p>
            </div>
            {phase === "preview" && (
              <div className="flex flex-wrap gap-2 text-[13px]"><span className="badge src-f">From the listing</span><span className="badge src-i">Worked out, please check</span><span className="badge src-m">Missing</span></div>
            )}
          </div>

          {duplicate && (
            <div role="alert" className="mx-6 mt-5 rounded-xl border p-3.5 text-sm" style={{ background: "var(--amber-bg)", borderColor: "var(--amber)", color: "var(--amber-fg)" }}>
              This looks like <strong>{duplicate.address}</strong>, which is already on your board. You can still save it, but check you aren't adding it twice.
            </div>
          )}

          <div className="flex flex-wrap gap-7 p-6">
            <div className="flex min-w-[240px] flex-1 flex-col gap-3">
              <Cover src={cover} tint="#CFD9D3" width="100%" height={200} radius={12} alt={cover ? "First listing photo" : undefined} />
              <span className="text-[13px] text-muted">{cover ? (shots.length ? "This photo is kept in HomeHunt, so the card always shows it." : "First photo saved to HomeHunt, so the card keeps its picture if the listing is taken down.") : "No photo yet. You can add your own after the viewing."}</span>
              {shotNote && <span role="status" className="text-[13px]" style={{ color: "var(--info-fg)" }}>{shotNote}</span>}
              {shots.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-ink-2">Use a whole screenshot as the photo instead</span>
                  <div className="flex flex-wrap gap-2">
                    {shots.map((x, i) => (
                      <button key={x.id} type="button" className="overflow-hidden rounded-lg border border-line p-0" aria-label={`Use screenshot ${i + 1} as the photo`} onClick={() => void useAsPhoto(x.blob)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={x.url} alt="" className="h-14 w-20 object-cover object-top" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {unreadable.length > 0 && <span className="text-[13px] text-muted">Couldn't read: {unreadable.join(", ").replace(/_/g, " ")}. Fill those in below.</span>}
              {form.asking_price && <span className="text-2xl font-extrabold">{gbp(num(form.asking_price))}</span>}
              {form.floor_area_sqft && <span className="text-sm text-muted">{sqftAndSqm(num(form.floor_area_sqft))}</span>}
            </div>
            <div className="grid min-w-[300px] flex-[2_1_480px] grid-cols-1 gap-4 sm:grid-cols-2">
              {FIELDS.map((f) => {
                const src = phase === "preview" ? sourceOf(f.key) : undefined;
                const miss = phase === "preview" && src === "missing";
                const partialPc = f.key === "postcode" && form.postcode && !/\d[A-Z]{2}$/i.test(form.postcode.trim());
                return (
                  <div key={f.key} className={f.wide ? "sm:col-span-2" : undefined}>
                    <Field id={`f-${f.key}`} label={f.label} source={src} note={partialPc ? "Partial postcode, so walking times are approximate until you confirm the address." : undefined}>
                      {f.kind === "select" ? (
                        <select id={`f-${f.key}`} className={cx("inp", miss && "inp-miss")} value={form[f.key]} onChange={(e) => set(f.key, e.target.value)}>
                          {f.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      ) : (
                        <input id={`f-${f.key}`} className={cx("inp", miss && "inp-miss")} type={f.kind === "number" ? "number" : "text"} inputMode={f.kind === "number" ? "decimal" : undefined} min={f.kind === "number" ? 0 : undefined} value={form[f.key]} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} aria-describedby={partialPc ? `f-${f.key}-note` : undefined} required={f.key === "address" || f.key === "asking_price"} />
                      )}
                    </Field>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap gap-5 border-t border-line-2 px-6 py-5" style={{ background: "var(--surface-2)" }}>
            <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="f-agent">Agent</label>
              <select id="f-agent" className="inp" value={agent} onChange={(e) => setAgent(e.target.value)}>
                <option value="">No agent yet</option>
                {s.data.agents.map((a) => <option key={a.id} value={a.id}>{a.name}{a.agency ? `, ${a.agency}` : ""}</option>)}
                <option value="__new">Add a new agent…</option>
              </select>
              {agent === "__new" && (
                <div className="mt-2 flex flex-col gap-2">
                  <input className="inp" aria-label="Agent name" placeholder="Name" value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} />
                  <input className="inp" aria-label="Agency" placeholder="Agency and branch" value={newAgent.agency} onChange={(e) => setNewAgent({ ...newAgent, agency: e.target.value })} />
                  <input className="inp" aria-label="Agent phone" type="tel" placeholder="Phone" value={newAgent.phone} onChange={(e) => setNewAgent({ ...newAgent, phone: e.target.value })} />
                </div>
              )}
            </div>
            <div className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="f-status">Status</label>
              <select id="f-status" className="inp" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="shortlisted">Shortlisted</option>
                <option value="viewing_booked">Viewing booked</option>
              </select>
            </div>
            <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor="f-when">Viewing</label>
              <input id="f-when" className="inp" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} disabled={status !== "viewing_booked"} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line-2 px-6 py-[18px]">
            <span className="text-sm text-muted">After saving we work out walking times and a score from these details.</span>
            <div className="flex gap-2.5">
              <button className="btn" type="button" onClick={() => { setPhase("idle"); setResult(null); }}>Cancel</button>
              <button className="btn btn-p" type="button" disabled={!valid || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save home"}</button>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
