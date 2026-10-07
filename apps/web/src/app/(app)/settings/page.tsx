"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DEFAULT_CONFIG, totalWeight, type CriterionKey, type ScoringConfig } from "@homehunt/scoring";
import { PageHeader, cx } from "@/components/ui";
import { activeConfig } from "@/lib/derive";
import { gbp, splitAddress } from "@/lib/format";
import { downloadText } from "@/lib/ics";
import { toCsv, toJson } from "@/lib/exporter";
import { store, useStore } from "@/lib/store";

const WEIGHTS: Array<{ key: CriterionKey; name: string; must: boolean }> = [
  { key: "budget", name: "Budget fit", must: true },
  { key: "station", name: "Station walk", must: true },
  { key: "space", name: "Living room and kitchen space", must: true },
  { key: "park", name: "Park nearby", must: true },
  { key: "supermarket", name: "Supermarket nearby", must: true },
  { key: "rest", name: "Rest of the home", must: false },
  { key: "extras", name: "Gym and restaurants", must: false },
  { key: "gut", name: "Gut feel", must: false },
];

const Panel = ({ title, children, id }: { title: string; children: React.ReactNode; id?: string }) => (
  <section id={id} className="panel flex flex-col gap-4 p-6" aria-label={title}>
    <h2 className="m-0 text-xl font-bold">{title}</h2>
    {children}
  </section>
);

const NumberField = ({ id, label, value, onChange, suffix, min = 0, max, step = 1, hint }: { id: string; label: string; value: number; onChange: (n: number) => void; suffix?: string; min?: number; max?: number; step?: number; hint?: string }) => (
  <div className="flex min-w-[180px] flex-1 flex-col gap-1.5">
    <label className="lab" htmlFor={id}>{label}</label>
    <div className="flex items-center gap-2"><input id={id} className="inp" type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""} onChange={(e) => onChange(Number(e.target.value))} />{suffix && <span className="text-sm text-muted">{suffix}</span>}</div>
    {hint && <span className="text-[13px] text-muted">{hint}</span>}
  </div>
);

export default function SettingsPage() {
  const s = useStore();
  const saved = activeConfig(s.data);
  const [cfg, setCfg] = useState<ScoringConfig>(saved.config);
  const [buyer, setBuyer] = useState(saved.buyerType);
  const [theme, setTheme] = useState("system");
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    setCfg(saved.config);
    setBuyer(saved.buyerType);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saved.version]);
  useEffect(() => {
    try {
      setTheme(localStorage.getItem("hh.theme") ?? "system");
    } catch {
      /* ignore */
    }
  }, []);

  const total = useMemo(() => totalWeight(cfg), [cfg]);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved.config) || buyer !== saved.buyerType;
  const ok = total === 100 && cfg.budget > 0 && cfg.tierCutoffs.top > cfg.tierCutoffs.strong && cfg.tierCutoffs.strong > cfg.tierCutoffs.maybe;
  const me = s.data.members.find((m) => m.id === s.me);

  const setW = (k: CriterionKey, v: number) => setCfg({ ...cfg, weights: { ...cfg.weights, [k]: v } });
  const balance = () => {
    const t = totalWeight(cfg) || 1;
    const w = { ...cfg.weights };
    const keys = Object.keys(w) as CriterionKey[];
    let acc = 0;
    keys.forEach((k) => { w[k] = Math.round((w[k] / t) * 100); acc += w[k]; });
    const biggest = keys.reduce((a, b) => (w[a] >= w[b] ? a : b));
    w[biggest] += 100 - acc;
    setCfg({ ...cfg, weights: w });
  };
  const setBudget = (n: number) => {
    const curve = cfg.budgetCurve.map((pt, i, arr) => (i === arr.length - 1 ? ([n, pt[1]] as const) : pt));
    setCfg({ ...cfg, budget: n, budgetCurve: curve });
  };
  const setCurvePt = (i: number, price?: number, score?: number) => {
    const curve = cfg.budgetCurve.map((pt, j) => (j === i ? ([price ?? pt[0], score === undefined ? pt[1] : score / 100] as const) : pt));
    setCfg({ ...cfg, budgetCurve: curve });
  };

  async function save() {
    await store.saveConfig(cfg, buyer);
    setFlash("Saved. Every home has been re-scored.");
    setTimeout(() => setFlash(null), 4000);
  }
  const applyTheme = (t: string) => {
    setTheme(t);
    try {
      if (t === "system") { localStorage.removeItem("hh.theme"); document.documentElement.removeAttribute("data-theme"); }
      else { localStorage.setItem("hh.theme", t); document.documentElement.setAttribute("data-theme", t); }
    } catch { /* ignore */ }
  };

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6 px-4 pt-6 pb-24 md:px-10 md:pt-9">
      <PageHeader title="Settings">Changes re-score every home straight away. Both of you share these settings.</PageHeader>

      <Panel title="Household">
        <div className="flex flex-wrap gap-4">
          {s.data.members.map((m) => (
            <div key={m.id} className="flex min-w-[200px] flex-1 flex-col gap-1.5">
              <label className="lab" htmlFor={`name-${m.id}`}>{m.id === s.me ? "Your name" : "Your partner's name"}</label>
              <input id={`name-${m.id}`} className="inp" defaultValue={m.display_name} onBlur={(e) => e.target.value.trim() && e.target.value !== m.display_name && void store.renameMember(m.id, e.target.value.trim())} />
            </div>
          ))}
        </div>
        <p className="m-0 text-sm text-muted">{s.mode === "supabase" ? "There is no sign-in: each of you picks your name on your own device. Renaming here updates it for both of you." : "Everything here is saved in this browser only. Open a second tab and choose the other name to rate as your partner."}</p>
      </Panel>

      <Panel title="Budget">
        <div className="flex flex-wrap gap-5">
          <NumberField id="b-max" label="Maximum price (£)" value={cfg.budget} onChange={setBudget} min={1} step={5000} hint="A home listed or offered above this is ruled out." />
          <div className="flex min-w-[320px] flex-[2_1_380px] flex-col gap-2">
            <span className="lab">Budget score by price</span>
            <div className="grid grid-cols-3 gap-2">
              {cfg.budgetCurve.map(([price, sub], i) => (
                <div key={i} className="flex flex-col gap-1.5 rounded-[10px] p-3" style={{ background: i === 0 ? "var(--accent-soft)" : "var(--line-2)" }}>
                  <label className="text-[13px]" htmlFor={`bc-p-${i}`}>{i === 0 ? "At or under (£)" : i === cfg.budgetCurve.length - 1 ? "At the limit (£)" : "Around (£)"}</label>
                  <input id={`bc-p-${i}`} className="inp !min-h-10" type="number" value={price} disabled={i === cfg.budgetCurve.length - 1} onChange={(e) => setCurvePt(i, Number(e.target.value))} />
                  <label className="text-[13px]" htmlFor={`bc-s-${i}`}>Score (%)</label>
                  <input id={`bc-s-${i}`} className="inp !min-h-10" type="number" min={0} max={100} value={Math.round(sub * 100)} onChange={(e) => setCurvePt(i, undefined, Math.min(100, Math.max(0, Number(e.target.value))))} />
                </div>
              ))}
            </div>
            <span className="text-[13px] text-muted">More headroom scores higher; between these points the score slides smoothly.</span>
          </div>
        </div>
      </Panel>

      <Panel title="What matters, and how much">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="m-0 text-sm text-muted">Weights must add up to 100. Must-haves also trigger a warning when missed.</p>
          <span className="text-[15px] font-bold" style={{ color: total === 100 ? "var(--accent)" : "var(--amber-fg)" }} role="status" aria-live="polite">{total === 100 ? "Total 100" : `Total ${total}, needs to be 100`}</span>
        </div>
        <div>
          {WEIGHTS.map((w) => (
            <div key={w.key} className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)_40px] items-center gap-4 border-t border-line-2 py-3 first:border-t-0">
              <label htmlFor={`w-${w.key}`} className="text-[15px] font-semibold">{w.name}{w.must && <span className="badge ml-2 src-f">Must-have</span>}</label>
              <input id={`w-${w.key}`} type="range" min={0} max={40} step={1} value={cfg.weights[w.key]} onChange={(e) => setW(w.key, Number(e.target.value))} className="h-7 w-full accent-[var(--accent)]" aria-valuetext={`${cfg.weights[w.key]} points`} />
              <span className="text-right text-[17px] font-bold">{cfg.weights[w.key]}</span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap justify-end gap-2.5">
          <button className="btn" onClick={balance} disabled={total === 100}>Scale to 100</button>
          <button className="btn" onClick={() => setCfg({ ...cfg, weights: DEFAULT_CONFIG.weights })}>Reset to defaults</button>
        </div>
      </Panel>

      <Panel title="Walking limits">
        <div className="flex flex-wrap gap-5">
          <NumberField id="l-st" label="Station, at most" value={cfg.softGates.stationMax} onChange={(n) => setCfg({ ...cfg, softGates: { ...cfg.softGates, stationMax: n } })} suffix="minutes" />
          <NumberField id="l-pk" label="Park, at most" value={cfg.softGates.parkMax} onChange={(n) => setCfg({ ...cfg, softGates: { ...cfg.softGates, parkMax: n } })} suffix="minutes" />
          <NumberField id="l-sh" label="Supermarket, at most" value={cfg.softGates.supermarketMax} onChange={(n) => setCfg({ ...cfg, softGates: { ...cfg.softGates, supermarketMax: n } })} suffix="minutes" />
          <NumberField id="l-sz" label="A park counts from" value={cfg.parkMinHectares} onChange={(n) => setCfg({ ...cfg, parkMinHectares: n })} suffix="hectares" step={0.5} min={0.1} hint="Walking times for parks use this next time you recalculate." />
        </div>
      </Panel>

      <Panel title="Tiers and costs">
        <div className="flex flex-wrap gap-5">
          <NumberField id="t-top" label="Top pick from" value={cfg.tierCutoffs.top} onChange={(n) => setCfg({ ...cfg, tierCutoffs: { ...cfg.tierCutoffs, top: n } })} suffix="points" max={100} />
          <NumberField id="t-strong" label="Strong contender from" value={cfg.tierCutoffs.strong} onChange={(n) => setCfg({ ...cfg, tierCutoffs: { ...cfg.tierCutoffs, strong: n } })} suffix="points" max={100} />
          <NumberField id="t-maybe" label="Maybe from" value={cfg.tierCutoffs.maybe} onChange={(n) => setCfg({ ...cfg, tierCutoffs: { ...cfg.tierCutoffs, maybe: n } })} suffix="points" max={100} />
        </div>
        <div className="flex flex-wrap gap-5">
          <div className="flex min-w-[220px] flex-1 flex-col gap-1.5"><label className="lab" htmlFor="buyer">Stamp duty estimate for</label>
            <select id="buyer" className="inp" value={buyer} onChange={(e) => setBuyer(e.target.value as typeof buyer)}><option value="first_time">First-time buyers</option><option value="standard">Standard rates</option></select></div>
          <NumberField id="uplift" label={'"Offers over" uplift'} value={Math.round(cfg.qualifierUplift * 1000) / 10} onChange={(n) => setCfg({ ...cfg, qualifierUplift: n / 100 })} suffix="%" step={0.5} hint="Scores an Offers over listing at its asking price plus this much, capped at your limit." />
        </div>
        {!(cfg.tierCutoffs.top > cfg.tierCutoffs.strong && cfg.tierCutoffs.strong > cfg.tierCutoffs.maybe) && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>Each tier needs a higher cut-off than the one below it.</p>}
      </Panel>

      <Panel title="Appearance">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme">
          {[["system", "Match my device"], ["light", "Light"], ["dark", "Dark"]].map(([k, l]) => <button key={k} className="filter" aria-pressed={theme === k} onClick={() => applyTheme(k)}>{l}</button>)}
        </div>
      </Panel>

      <Panel title="Your data">
        <div className="flex flex-wrap gap-2.5">
          <button className="btn" onClick={() => downloadText("homehunt-homes.csv", toCsv(s.data, s.me!), "text/csv;charset=utf-8")}>Export CSV</button>
          <button className="btn" onClick={() => downloadText("homehunt-export.json", toJson(s.data), "application/json")}>Export everything (JSON)</button>
          <button className="btn btn-danger" onClick={() => { if (confirm("Delete every agent's contact details? Homes and viewings are kept.")) s.data.agents.forEach((a) => void store.saveAgent({ ...a, phone: null, mobile: null, email: null, notes: null })); }}>Clear agent contact details</button>
        </div>
        <details>
          <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">Delete a home for good</summary>
          <p className="m-0 mb-2 text-sm text-muted">Archiving keeps a home's history. Deleting removes it and its ratings, notes and offers.</p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {s.data.properties.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-3 text-sm"><span>{splitAddress(p.address).street}{p.archived_at ? " (archived)" : ""}</span>
                <button className="btn btn-danger !min-h-9" onClick={() => { if (confirm(`Delete ${splitAddress(p.address).street} and everything saved about it? This can't be undone.`)) void store.hardDelete(p.id); }}>Delete</button></li>
            ))}
          </ul>
        </details>
      </Panel>

      <Panel title="This device">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-sm text-muted">You are {me?.display_name}. Agents are on their <Link href="/agents">own page</Link>.</span>
          <button className="btn" onClick={() => void store.signOut()}>Switch person</button>
          {s.mode === "local" && (
            <>
              <button className="btn" onClick={() => { if (confirm("Replace everything with the sample homes?")) void store.loadSample(); }}>Load sample homes</button>
              <button className="btn btn-danger" onClick={() => { if (confirm("Delete everything in this browser and start empty?")) void store.startEmpty(); }}>Start empty</button>
            </>
          )}
        </div>
        <p className="m-0 text-[13px] text-muted">Scoring settings are on version {saved.version}. Older scores stay explainable because each version is kept.</p>
      </Panel>

      <div className="fixed inset-x-0 bottom-[84px] z-20 mx-auto flex max-w-[960px] items-center justify-end gap-3 px-4 md:bottom-0 md:px-10" style={{ pointerEvents: "none" }}>
        <div className={cx("flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 shadow-lg", !dirty && !flash && "hidden")} style={{ pointerEvents: "auto" }}>
          {flash ? <span role="status" className="text-sm font-semibold text-accent">{flash}</span> : (
            <>
              <span className="text-sm text-muted">{ok ? `Unsaved changes. Budget ${gbp(cfg.budget)}.` : "Fix the highlighted values to save."}</span>
              <button className="btn" onClick={() => { setCfg(saved.config); setBuyer(saved.buyerType); }}>Discard</button>
              <button className="btn btn-p" disabled={!ok} onClick={() => void save()}>Save changes</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
