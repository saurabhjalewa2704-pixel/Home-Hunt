"use client";
import { useEffect, useState } from "react";
import { EMPTY, FIELDS, num, toForm, type Form } from "@/lib/fields";
import { fmtDay, fmtWhen, gbp, nowIso, sqftAndSqm, uid } from "@/lib/format";
import { blobs, resizeImage } from "@/lib/offline";
import { imageSrc } from "@/lib/images";
import { store } from "@/lib/store";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase";
import { STATUS_LABELS, type Photo, type Property } from "@/lib/types";
import { IWarn } from "../icons";
import { Field, cx } from "../ui";
import type { Ctx } from "./ctx";
import { memberOf } from "./ctx";

function usePhotoUrl(path: string): string | null {
  const [url, setUrl] = useState<string | null>(path.startsWith("local:") ? null : imageSrc(path));
  useEffect(() => {
    if (!path.startsWith("local:")) return setUrl(imageSrc(path));
    let revoke: string | null = null;
    let live = true;
    blobs.get(path.slice(6)).then((b) => {
      if (b && live) {
        revoke = URL.createObjectURL(b);
        setUrl(revoke);
      }
    }).catch(() => {});
    return () => {
      live = false;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [path]);
  return url;
}

function Thumb({ photo, onOpen }: { photo: Photo; onOpen: (u: string) => void }) {
  const url = usePhotoUrl(photo.storage_path);
  return (
    <button className="h-24 w-24 overflow-hidden rounded-xl border border-line p-0" style={{ background: "var(--line-2)" }} onClick={() => url && onOpen(url)} aria-label="Open photo">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {url && <img src={url} alt="" className="h-full w-full object-cover" />}
    </button>
  );
}

function Photos({ ctx }: { ctx: Ctx }) {
  const p = ctx.d.property;
  const photos = ctx.data.photos.filter((x) => x.property_id === p.id);
  const [big, setBig] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function add(files: FileList | null) {
    if (!files) return;
    setErr(null);
    const left = 30 - photos.length;
    for (const f of Array.from(files).slice(0, Math.max(0, left))) {
      try {
        const blob = await resizeImage(f, 1600);
        const id = uid();
        if (hasSupabase) {
          const path = `${ctx.data.household.id}/${p.id}/${id}.jpg`;
          const { error } = await supabaseBrowser().storage.from("property-photos").upload(path, blob, { contentType: "image/jpeg" });
          if (error) throw error;
          await store.addPhoto(p.id, `photos:${path}`);
        } else {
          await blobs.put(id, blob);
          await store.addPhoto(p.id, `local:${id}`);
        }
      } catch {
        setErr("One photo couldn't be saved. Check your connection and try again.");
      }
    }
  }
  return (
    <section className="flex flex-col gap-3" aria-label="Your photos">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="m-0 text-lg font-bold">Your photos <span className="text-sm font-normal text-muted">({photos.length} of 30)</span></h3>
        <label className="btn cursor-pointer">Add photos<input type="file" accept="image/*" multiple capture="environment" className="sr-only" onChange={(e) => { void add(e.target.files); e.target.value = ""; }} /></label>
      </div>
      {err && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>{err}</p>}
      <div className="flex flex-wrap gap-2">{photos.map((ph) => <Thumb key={ph.id} photo={ph} onOpen={setBig} />)}{!photos.length && <p className="m-0 text-sm text-muted">Photos you take at the viewing live here.</p>}</div>
      {big && (
        <div role="dialog" aria-label="Photo" className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={() => setBig(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={big} alt="" className="max-h-full max-w-full rounded-lg" />
          <button className="btn absolute top-4 right-4" onClick={() => setBig(null)}>Close</button>
        </div>
      )}
    </section>
  );
}

function Facts({ ctx }: { ctx: Ctx }) {
  const p = ctx.d.property;
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<Form>(EMPTY);
  const start = () => { setF(toForm({ ...p } as never)); setEdit(true); };
  const row = (k: string, v: string | number | null | undefined, hint?: string) => (
    <div key={k} className="flex flex-col gap-0.5"><dt className="text-[13px] text-muted">{k}</dt><dd className="m-0 text-[15px] font-semibold">{v === null || v === undefined || v === "" ? <span className="font-normal text-muted">Not known</span> : v}{hint && <span className="block text-[12.5px] font-normal text-muted">{hint}</span>}</dd></div>
  );
  const lease = p.tenure === "leasehold" && p.lease_years != null && p.lease_years < 90;

  if (edit) {
    return (
      <form className="panel grid gap-4 p-5 sm:grid-cols-2" onSubmit={async (e) => {
        e.preventDefault();
        const sources = { ...p.field_sources };
        for (const fd of FIELDS) if (f[fd.key] !== String(((p as unknown) as Record<string, unknown>)[fd.key] ?? "")) sources[fd.key] = "manual";
        await store.saveProperty({
          ...p, address: f.address.trim() || p.address, asking_price: num(f.asking_price) ?? p.asking_price, price_qualifier: (f.price_qualifier || "guide") as Property["price_qualifier"],
          postcode: f.postcode.trim().toUpperCase() || null, property_type: f.property_type || null, beds: num(f.beds), baths: num(f.baths), floor_area_sqft: num(f.floor_area_sqft),
          tenure: (f.tenure || null) as Property["tenure"], lease_years: num(f.lease_years), service_charge: num(f.service_charge), ground_rent: num(f.ground_rent),
          council_tax_band: f.council_tax_band.trim().toUpperCase().slice(0, 1) || null, epc: f.epc.trim().toUpperCase().slice(0, 1) || null, field_sources: sources,
        });
        setEdit(false);
      }}>
        {FIELDS.map((fd) => (
          <div key={fd.key} className={fd.wide ? "sm:col-span-2" : undefined}>
            <Field id={`e-${fd.key}`} label={fd.label}>
              {fd.kind === "select" ? (
                <select id={`e-${fd.key}`} className="inp" value={f[fd.key]} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })}>{fd.options!.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
              ) : (
                <input id={`e-${fd.key}`} className="inp" type={fd.kind === "number" ? "number" : "text"} min={fd.kind === "number" ? 0 : undefined} value={f[fd.key]} onChange={(e) => setF({ ...f, [fd.key]: e.target.value })} />
              )}
            </Field>
          </div>
        ))}
        <div className="flex gap-2.5 sm:col-span-2"><button className="btn btn-p">Save changes</button><button type="button" className="btn" onClick={() => setEdit(false)}>Cancel</button></div>
      </form>
    );
  }
  return (
    <div className="panel flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="m-0 text-lg font-bold">Listing facts</h3><button className="btn" onClick={start}>Edit details</button></div>
      <dl className="m-0 grid grid-cols-2 gap-x-5 gap-y-4 md:grid-cols-4">
        {row("Property type", p.property_type)}
        {row("Bedrooms", p.beds)}
        {row("Bathrooms", p.baths)}
        {row("Receptions", p.receptions)}
        {row("Floor area", p.floor_area_sqft ? sqftAndSqm(p.floor_area_sqft) : null)}
        {row("Tenure", p.tenure ? p.tenure.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase()) : null)}
        {row("Lease left", p.lease_years != null ? `${p.lease_years} years` : null)}
        {row("Service charge", p.service_charge != null ? `${gbp(p.service_charge)} a year` : null)}
        {row("Ground rent", p.ground_rent != null ? `${gbp(p.ground_rent)} a year` : null)}
        {row("Council tax band", p.council_tax_band)}
        {row("EPC rating", p.epc)}
        {row("Postcode", p.postcode, p.address_precision === "approximate" ? "Partial, so walking times are approximate" : undefined)}
      </dl>
      {lease && (
        <p role="note" className="m-0 flex flex-wrap items-center gap-3 rounded-xl p-3 text-sm chip-warn"><IWarn />
          <span>{p.lease_years} years left is short{p.lease_years! < 80 ? ": under 80 years usually adds a large lease-extension cost." : ": under 90 years starts to add lease-extension cost."}</span>
          {!ctx.data.pro_cons.some((c) => c.property_id === p.id && c.member_id === ctx.me.id && /lease/i.test(c.text)) && (
            <button className="btn !min-h-9" onClick={() => void store.saveProCon({ property_id: p.id, kind: "con", text: "Lease will need extending", impact: p.lease_years! < 80 ? "major" : "major", deal_breaker: false })}>Add as a con</button>
          )}
        </p>
      )}
    </div>
  );
}

export function OverviewTab({ ctx }: { ctx: Ctx }) {
  const { d, data } = ctx;
  const p = d.property;
  const [note, setNote] = useState("");
  const [refresh, setRefresh] = useState<string | null>(null);
  const notes = data.notes.filter((n) => n.property_id === p.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const history = data.status_events.filter((e) => e.property_id === p.id).sort((a, b) => b.at.localeCompare(a.at));
  const [more, setMore] = useState(false);

  async function refreshFromListing() {
    if (!p.listing_url) return;
    setRefresh("Checking the listing…");
    try {
      const res = await fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url: p.listing_url }) });
      const j = await res.json();
      if (!res.ok) return setRefresh(j?.error?.message ?? "Couldn't reach the listing.");
      const price = j.result?.draft?.asking_price as number | null;
      if (price && price !== p.asking_price) {
        await store.addNote(p.id, `Price changed from ${gbp(p.asking_price)} to ${gbp(price)} on ${fmtDay(nowIso())}.`);
        await store.saveProperty({ ...p, asking_price: price });
        setRefresh(`Price is now ${gbp(price)}, was ${gbp(p.asking_price)}. Noted below.`);
      } else setRefresh("Nothing has changed on the listing.");
    } catch {
      setRefresh("You seem to be offline.");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Facts ctx={ctx} />
      {p.key_features.length > 0 && (
        <section className="panel p-5"><h3 className="m-0 mb-2 text-lg font-bold">Key features</h3><ul className="m-0 grid list-disc gap-1 pl-5 sm:grid-cols-2">{p.key_features.map((k) => <li key={k}>{k}</li>)}</ul></section>
      )}
      {p.description && (
        <section className="panel p-5"><h3 className="m-0 mb-2 text-lg font-bold">From the listing</h3>
          <p className={cx("m-0 leading-6 text-ink-2", !more && "line-clamp-4")}>{p.description}</p>
          {p.description.length > 300 && <button className="mt-2 text-sm font-semibold text-accent underline" onClick={() => setMore((m) => !m)}>{more ? "Show less" : "Read more"}</button>}
        </section>
      )}

      <section className="panel flex flex-col gap-3 p-5" aria-label="Notes">
        <h3 className="m-0 text-lg font-bold">Notes</h3>
        <form className="flex flex-col gap-2" onSubmit={async (e) => { e.preventDefault(); if (!note.trim()) return; await store.addNote(p.id, note.trim()); setNote(""); }}>
          <label className="lab" htmlFor="note">Add a note</label>
          <textarea id="note" className="inp" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
          <button className="btn w-fit" disabled={!note.trim()}>Save note</button>
        </form>
        {notes.map((n) => (
          <div key={n.id} className="border-t border-line-2 pt-3 text-[15px]"><p className="m-0 leading-6">{n.text}</p><span className="text-[13px] text-muted">{memberOf(ctx, n.member_id)?.display_name}, {fmtWhen(n.created_at)}</span></div>
        ))}
      </section>

      <Photos ctx={ctx} />

      <section className="panel flex flex-col gap-3 p-5" aria-label="History">
        <h3 className="m-0 text-lg font-bold">Status history</h3>
        <ol className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm">
          {history.map((e) => <li key={e.id} className="text-ink-2">{fmtWhen(e.at)}: {e.from_status ? `${STATUS_LABELS[e.from_status]} → ` : "Added as "}<strong>{STATUS_LABELS[e.to_status]}</strong>{e.member_id ? ` (${memberOf(ctx, e.member_id)?.display_name})` : ""}</li>)}
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          {p.listing_url && <button className="btn" onClick={() => void refreshFromListing()}>Refresh from listing</button>}
          <button className="btn" onClick={() => void store.archive(p.id, !p.archived_at)}>{p.archived_at ? "Unarchive" : "Archive this home"}</button>
          <span role="status" className="text-sm text-muted">{refresh}</span>
        </div>
      </section>
    </div>
  );
}
