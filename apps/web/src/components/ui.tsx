"use client";
import Link from "next/link";
import { useEffect, useRef, type ReactNode } from "react";
import { TIER_COLOR } from "@/lib/derive";
import type { Tier } from "@homehunt/scoring";
import type { Member } from "@/lib/types";
import { imageSrc } from "@/lib/images";
import { IHouse } from "./icons";

export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(" ");

export function Avatar({ member, size = 22, className }: { member: Member | undefined; size?: number; className?: string }) {
  const name = member?.display_name ?? "?";
  return (
    <span
      className={cx("av", className)}
      style={{ background: member?.colour ?? "#6a737c", width: size, height: size, fontSize: Math.round(size * 0.5) }}
      title={name}
      aria-label={name}
      role="img"
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Score ring: the number is always shown, so colour is never the only signal. Provisional is dashed. */
export function ScoreRing({ score, tier, provisional, size = 64, label = true }: { score: number; tier: Tier | "to_view"; provisional?: boolean; size?: number; label?: boolean }) {
  const color = TIER_COLOR[tier];
  const inner = Math.round(size * 0.78);
  const font = Math.round(size * 0.31);
  if (provisional) {
    return (
      <span role="img" aria-label={`Provisional score ${Math.round(score)}, from the listing only`}
        style={{ width: size, height: size, border: "2px dashed var(--muted)", background: "var(--surface)" }}
        className="inline-flex flex-none items-center justify-center rounded-full">
        <span className="flex flex-col items-center leading-none">
          <span style={{ fontSize: font, fontWeight: 700, color: "var(--muted)" }}>{Math.round(score)}</span>
          {label && size >= 56 && <span style={{ fontSize: 10.5, color: "var(--muted)", marginTop: 3 }}>so far</span>}
        </span>
      </span>
    );
  }
  return (
    <span role="img" aria-label={`Score ${Math.round(score)} out of 100`}
      style={{ width: size, height: size, background: `conic-gradient(${color} ${Math.max(0, Math.min(100, score)) * 3.6}deg, var(--track) 0)` }}
      className="inline-flex flex-none items-center justify-center rounded-full">
      <span style={{ width: inner, height: inner, fontSize: font, fontWeight: 700, background: "var(--surface)" }} className="inline-flex items-center justify-center rounded-full">
        {Math.round(score)}
      </span>
    </span>
  );
}

const bar = (m: number, limit = 15) => ({
  w: `${(Math.min(m, 20) / 20) * 100}%`,
  c: m > limit ? "var(--amber)" : m > 10 ? "var(--tier-unlikely)" : "var(--accent)",
});

export function WalkLanes({ station, park, shops, compact }: { station?: number | null; park?: number | null; shops?: number | null; compact?: boolean }) {
  const rows: Array<[string, number | null | undefined]> = [["Station", station], ["Park", park], ["Shops", shops]];
  const label = rows.map(([n, v]) => `${n} ${v ?? "unknown"}${v != null ? " minutes" : ""}`).join(", ");
  return (
    <span className="flex flex-col" style={{ gap: compact ? 6 : 7 }} aria-label={`Walking times: ${label}`}>
      {rows.map(([name, v]) => {
        const b = v != null ? bar(v) : null;
        return (
          <span key={name} className="lane" style={compact ? { gridTemplateColumns: "44px minmax(0,1fr) 38px", fontSize: 11.5, gap: 6 } : undefined}>
            <span>{name}</span>
            <span className="track">
              {b && <span className="fill" style={{ width: b.w, background: b.c }} />}
              <span className="limit" />
            </span>
            <span className="lane-v">{v != null ? `${v} min` : "–"}</span>
          </span>
        );
      })}
    </span>
  );
}

export function Cover({ src, tint, width, height, radius = 10, alt }: { src?: string | null; tint?: string | null; width?: number | string; height?: number | string; radius?: number; alt?: string }) {
  return (
    <span className="relative block flex-none overflow-hidden" style={{ width, height, borderRadius: radius, background: tint ?? "var(--line-2)", color: "var(--ink)" }} role={alt ? "img" : undefined} aria-label={alt} aria-hidden={alt ? undefined : true}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageSrc(src) ?? undefined} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="absolute inset-0 flex items-end justify-center"><IHouse w={Number(width) || 120} h={Number(height) || 84} /></span>
      )}
    </span>
  );
}

export function LinkButton({ href, children, primary, className, ...rest }: { href: string; children: ReactNode; primary?: boolean; className?: string } & Record<string, unknown>) {
  return <Link href={href} className={cx("btn", primary && "btn-p", className)} {...rest}>{children}</Link>;
}

export function PageHeader({ title, children, actions }: { title: string; children?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-5">
      <div className="flex flex-col gap-2">
        <h1 className="m-0 text-[32px] leading-9 font-extrabold tracking-[-0.025em] md:text-[40px] md:leading-[44px]">{title}</h1>
        {children && <p className="m-0 max-w-[62ch] text-base leading-6 text-muted">{children}</p>}
      </div>
      {actions}
    </header>
  );
}

export function Field({ id, label, children, source, note }: { id: string; label: string; children: ReactNode; source?: "fetched" | "inferred" | "missing" | "manual"; note?: ReactNode }) {
  const tag = source === "fetched" ? ["src-f", "From the listing"] : source === "inferred" ? ["src-i", "Worked out, please check"] : source === "missing" ? ["src-m", "Missing"] : source === "manual" ? ["src-f", "Entered by you"] : null;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="lab" htmlFor={id}>
        {label}
        {tag && <span className={cx("badge", tag[0])}>{tag[1]}</span>}
      </label>
      {children}
      {note && <span className="text-[12.5px] leading-[17px]" style={{ color: "var(--info-fg)" }} id={`${id}-note`}>{note}</span>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="panel flex flex-col items-start gap-3 p-8">
      <h2 className="m-0 text-xl font-bold">{title}</h2>
      <p className="m-0 max-w-[60ch] text-muted">{body}</p>
      {action}
    </div>
  );
}

export function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label={title}
      className="m-auto w-[min(520px,calc(100vw-32px))] rounded-2xl border border-line bg-surface p-0 text-ink backdrop:bg-black/40">
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <h2 className="m-0 text-xl font-bold">{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

const IMPACT_N = { minor: 1, moderate: 2, major: 3 } as const;
export function ImpactDots({ impact, kind }: { impact: keyof typeof IMPACT_N; kind: "pro" | "con" }) {
  const n = IMPACT_N[impact];
  const color = kind === "pro" ? "var(--accent)" : "var(--danger)";
  return (
    <span className="dots" role="img" aria-label={`${impact[0].toUpperCase()}${impact.slice(1)} ${kind}`}>
      {[1, 2, 3].map((i) => <span key={i} className="dot" style={i <= n ? { background: color } : undefined} />)}
    </span>
  );
}
