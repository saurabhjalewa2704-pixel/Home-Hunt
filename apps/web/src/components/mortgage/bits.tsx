"use client";
import { useId, useState, type ReactNode } from "react";
import { parseRate } from "@/lib/mortgage-calc";
import { SC_FOOTNOTE } from "@/lib/mortgage";
import { cx } from "../ui";

export const Estimate = ({ className }: { className?: string }) => <p className={cx("m-0 text-[13px] text-muted", className)}>{SC_FOOTNOTE}</p>;

/** A row of mutually exclusive choices, for example "Fixed for 2 / 3 / 5 / 10 years". */
export function Seg<T extends string | number>({ label, value, options, onChange, cols }: { label: string; value: T; options: Array<{ value: T; label: string }>; onChange: (v: T) => void; cols?: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="lab">{label}</span>
      <div className="mseg" role="group" aria-labelledby={id} style={{ gridTemplateColumns: `repeat(${cols ?? options.length}, minmax(0, 1fr))` }}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>{o.label}</button>
        ))}
      </div>
    </div>
  );
}

/**
 * An interest rate typed in a number field with a slider beside it, kept in sync (MC-9).
 * Typing updates the results as you go; dragging the slider updates the field. A value outside the
 * slider's range is kept and the slider rests at its nearest end. Arrow keys step by 0.01.
 */
export function RateField({ label, value, onChange, sliderMin = 2, sliderMax = 8, error, hint, disabled, id }: { label: string; value: string; onChange: (s: string) => void; sliderMin?: number; sliderMax?: number; error?: string; hint?: ReactNode; disabled?: boolean; id: string }) {
  const parsed = parseRate(value);
  const slider = Math.min(sliderMax, Math.max(sliderMin, parsed ?? sliderMin));
  const outside = parsed !== null && (parsed < sliderMin || parsed > sliderMax);
  return (
    <div className="flex flex-col gap-2">
      <label className="lab" htmlFor={id}>{label}</label>
      <div className="flex items-center gap-4">
        <span className={cx("mnum", error && "mnum-bad")}>
          <input id={id} type="number" inputMode="decimal" min={0.01} max={15} step={0.01} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={`${id}-h`} />
          <span aria-hidden>%</span>
        </span>
        <input className="mrng" type="range" min={sliderMin} max={sliderMax} step={0.05} value={slider} disabled={disabled} onChange={(e) => onChange(Number(e.target.value).toFixed(2))} aria-label={`${label} slider`} />
      </div>
      <span id={`${id}-h`} className="text-[13px] leading-[18px]" style={{ color: error ? "var(--danger)" : "var(--muted)" }}>
        {error ?? hint ?? (outside ? "Your rate is outside the slider's range, which is fine." : "Type the exact rate from a quote, or drag.")}
      </span>
    </div>
  );
}

/** A number typed in pounds. Empty shows blank rather than 0. */
export function MoneyField({ id, label, value, onChange, error, hint, min = 0, max, step = 1, prefix = "£", suffix, disabled }: { id: string; label: string; value: number; onChange: (n: number) => void; error?: string; hint?: ReactNode; min?: number; max?: number; step?: number; prefix?: string; suffix?: string; disabled?: boolean }) {
  return (
    <div className="flex min-w-[150px] flex-1 flex-col gap-1.5">
      <label className="lab" htmlFor={id}>{label}</label>
      <span className={cx("mnum !w-full", error && "mnum-bad")}>
        {prefix && <span aria-hidden className="text-muted">{prefix}</span>}
        <input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={Number.isFinite(value) && value !== 0 ? value : value === 0 ? 0 : ""} disabled={disabled} onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))} aria-invalid={error ? true : undefined} aria-describedby={error || hint ? `${id}-h` : undefined} />
        {suffix && <span aria-hidden className="text-muted">{suffix}</span>}
      </span>
      {(error || hint) && <span id={`${id}-h`} className="text-[13px] leading-[18px]" style={{ color: error ? "var(--danger)" : "var(--muted)" }}>{error ?? hint}</span>}
    </div>
  );
}

/** A labelled slider with its current value on the right. */
export function SliderField({ id, label, valueText, min, max, step, value, onChange }: { id: string; label: string; valueText: string; min: number; max: number; step: number; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3"><label className="lab" htmlFor={id}>{label}</label><span className="text-lg font-bold">{valueText}</span></div>
      <input className="mrng" id={id} type="range" min={min} max={max} step={step} value={Math.min(max, Math.max(min, value))} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/** Banner shown when the mortgage tables haven't been created in Supabase yet. */
export function SetupBanner({ missing }: { missing: boolean }) {
  const [shown, setShown] = useState(true);
  if (!missing || !shown) return null;
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm leading-5" style={{ background: "var(--amber-bg)", borderColor: "var(--amber)", color: "var(--amber-fg)" }}>
      <span className="min-w-[240px] flex-1"><strong>One more step to save scenarios.</strong> Your database doesn't have the mortgage tables yet. Open the Supabase SQL editor, paste the contents of <code>supabase/migrations/0002_mortgage.sql</code>, run it, then reload. You can still use the calculator meanwhile.</span>
      <button className="btn" onClick={() => setShown(false)}>Hide</button>
    </div>
  );
}
