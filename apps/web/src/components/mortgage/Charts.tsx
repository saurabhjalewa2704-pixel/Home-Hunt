"use client";
import { linePath, niceTicks, scale } from "@/lib/chart";
import { gbp, gbp2, gbpK, yrsMos } from "@/lib/format";

const AXIS = { fill: "var(--muted)", fontSize: 12 } as const;
const GRID = { stroke: "var(--line-2)" } as const;

export interface BalancePoint {
  year: number;
  balance: number;
}

/** Outstanding balance by year for one mortgage, with the end of the initial period marked. */
export function BalanceChart({ points, termYears, fixYears, label }: { points: BalancePoint[]; termYears: number; fixYears: number; label: string }) {
  const W = 640, H = 230, L = 56, R = 620, T = 20, B = 200;
  const max = Math.max(...points.map((p) => p.balance), 1);
  const x = scale(0, termYears, L, R);
  const y = scale(0, max, B, T + 10);
  const pts = points.map((p) => [x(p.year), y(p.balance)] as [number, number]);
  const line = linePath(pts);
  const last = pts[pts.length - 1] ?? [L, B];
  const step = termYears > 20 ? 5 : 2;
  const xt: number[] = [];
  for (let v = 0; v <= termYears; v += step) xt.push(v);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={L} x2={R} y1={y(max * f)} y2={y(max * f)} {...GRID} />
          <text x={L - 8} y={y(max * f) + 4} textAnchor="end" {...AXIS}>{f === 0 ? "£0" : gbpK(max * f)}</text>
        </g>
      ))}
      {xt.map((v) => <text key={v} x={x(v)} y={222} textAnchor="middle" {...AXIS}>{v === 0 ? "Now" : `Year ${v}`}</text>)}
      <path d={`${line} L${last[0].toFixed(1)} ${B} L${L} ${B} Z`} style={{ fill: "var(--accent)", fillOpacity: 0.1 }} />
      <path d={line} style={{ fill: "none", stroke: "var(--accent)", strokeWidth: 2.5 }} />
      {fixYears > 0 && fixYears < termYears && (
        <g>
          <line x1={x(fixYears)} x2={x(fixYears)} y1={T} y2={B} style={{ stroke: "var(--muted)" }} strokeDasharray="4 4" />
          <text x={x(fixYears) + 6} y={28} {...AXIS}>Fix ends</text>
        </g>
      )}
      {points.filter((_, i) => i % Math.max(1, Math.round(points.length / 12)) === 0).map((p) => (
        <circle key={p.year} cx={x(p.year)} cy={y(p.balance)} r={9} fill="transparent"><title>{`Year ${p.year}: ${gbp(p.balance)} still owed`}</title></circle>
      ))}
    </svg>
  );
}

export interface ScatterItem {
  id: string;
  letter: string;
  colour: string;
  name: string;
  pay: number;
  interest: number;
}

/** One dot per scenario: monthly payment across, total interest up. Cheaper on both counts is down and to the left. */
export function ScatterChart({ items, compact }: { items: ScatterItem[]; compact?: boolean }) {
  const W = compact ? 358 : 520, H = compact ? 220 : 330, L = compact ? 52 : 70, R = W - 20, T = 20, B = compact ? 170 : 260;
  const pays = items.map((i) => i.pay), ints = items.map((i) => i.interest);
  const padX = Math.max(60, (Math.max(...pays) - Math.min(...pays)) * 0.15), padY = Math.max(10_000, (Math.max(...ints) - Math.min(...ints)) * 0.15);
  const xt = niceTicks(Math.min(...pays) - padX, Math.max(...pays) + padX, compact ? 2 : 4);
  const yt = niceTicks(Math.min(...ints) - padY, Math.max(...ints) + padY, compact ? 3 : 4);
  const x = scale(xt[0], xt[xt.length - 1], L, R);
  const y = scale(yt[0], yt[yt.length - 1], B, T);
  const cheapestPay = items.reduce((a, b) => (b.pay < a.pay ? b : a));
  const cheapestInt = items.reduce((a, b) => (b.interest < a.interest ? b : a));
  const aria = `${cheapestPay.letter} has the lowest monthly payment (${gbp(cheapestPay.pay)}) and ${cheapestInt.letter} the lowest total interest (${gbp(cheapestInt.interest)}).`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={aria} style={{ display: "block" }}>
      {yt.map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} {...GRID} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{gbpK(v)}</text>
        </g>
      ))}
      {xt.map((v) => <text key={v} x={x(v)} y={B + 20} textAnchor="middle" {...AXIS}>{gbp(v)}</text>)}
      <text x={(L + R) / 2} y={H - 6} textAnchor="middle" {...AXIS}>Monthly payment</text>
      <text transform={`rotate(-90 14 ${(T + B) / 2})`} x={14} y={(T + B) / 2} textAnchor="middle" {...AXIS}>Total interest</text>
      {items.map((i) => (
        <g key={i.id}>
          <circle cx={x(i.pay)} cy={y(i.interest)} r={12} style={{ fill: i.colour, stroke: "var(--surface)", strokeWidth: 2 }}>
            <title>{`${i.letter}. ${i.name}: ${gbp2(i.pay)} a month, ${gbp(i.interest)} interest`}</title>
          </circle>
          <text x={x(i.pay)} y={y(i.interest) + 4.5} textAnchor="middle" fontSize={13} fontWeight={800} fill="#fff" pointerEvents="none">{i.letter}</text>
        </g>
      ))}
    </svg>
  );
}

export interface LineSeries {
  id: string;
  letter: string;
  colour: string;
  width: number;
  /** Balance at the end of each year, starting with the loan at year 0. */
  balances: number[];
}

/** Balance over time, one line per scenario in its colour, each labelled at its end. */
export function LinesChart({ series, compact }: { series: LineSeries[]; compact?: boolean }) {
  const W = compact ? 358 : 520, H = compact ? 210 : 330, L = compact ? 52 : 70, R = W - (compact ? 28 : 80), T = 20, B = compact ? 160 : 260;
  const maxY = Math.max(...series.flatMap((s) => s.balances), 1);
  const maxX = Math.max(...series.map((s) => s.balances.length - 1), 1);
  const yt = niceTicks(0, maxY, compact ? 3 : 4);
  const xs = niceTicks(0, maxX, compact ? 3 : 6).filter((v) => v <= maxX);
  const x = scale(0, maxX, L, R);
  const y = scale(0, yt[yt.length - 1], B, T);
  const seen = new Map<number, number>();
  const aria = `Balance over time: ${[...series].sort((a, b) => a.balances.length - b.balances.length).map((s) => `${s.letter} is cleared after ${s.balances.length - 1} years`).join(", ")}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={aria} style={{ display: "block" }}>
      {yt.map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} {...GRID} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{v ? gbpK(v) : "£0"}</text>
        </g>
      ))}
      {xs.map((v) => <text key={v} x={x(v)} y={B + 20} textAnchor="middle" {...AXIS}>{v === 0 ? "Now" : v}</text>)}
      <text x={(L + R) / 2} y={H - 6} textAnchor="middle" {...AXIS}>Years from completion</text>
      {series.map((s) => {
        const end = s.balances.length - 1;
        const k = seen.get(end) ?? 0;
        seen.set(end, k + 1);
        return (
          <g key={s.id}>
            <path d={linePath(s.balances.map((b, i) => [x(i), y(b)] as [number, number]))} style={{ fill: "none", stroke: s.colour, strokeWidth: s.width, strokeLinejoin: "round" }} />
            <circle cx={x(end)} cy={y(0)} r={4} style={{ fill: s.colour, stroke: "var(--surface)", strokeWidth: 2 }} />
            <text x={x(end) + 8} y={y(0) - 4 - k * 14} fontSize={13} fontWeight={700} style={{ fill: s.colour }}>{s.letter}</text>
          </g>
        );
      })}
    </svg>
  );
}

/** Balance with and without overpayments, the gap shaded and the new end marked. */
export function OverpayChart({ base, over, termYears, fixYears, endMonths, compact }: { base: BalancePoint[]; over: BalancePoint[]; termYears: number; fixYears: number; endMonths: number; compact?: boolean }) {
  const W = compact ? 358 : 680, H = compact ? 190 : 270, L = compact ? 20 : 60, R = W - (compact ? 18 : 20), T = 20, B = compact ? 160 : 240;
  const max = Math.max(...base.map((p) => p.balance), 1);
  const x = scale(0, termYears, L, R);
  const y = scale(0, max, B, T + 5);
  const endY = endMonths / 12;
  const pts = (a: BalancePoint[]) => a.map((p) => [x(p.year), y(p.balance)] as [number, number]);
  const cut = base.filter((p) => p.year <= endY);
  const next = base.find((p) => p.year >= endY) ?? base[base.length - 1];
  const gap = `${linePath(pts(cut))} L${x(endY).toFixed(1)} ${y(next.balance).toFixed(1)} ${[...pts(over)].reverse().map(([a, b]) => `L${a.toFixed(1)} ${b.toFixed(1)}`).join(" ")} Z`;
  const ticks = niceTicks(0, max, 3);
  const xt: number[] = [];
  for (let v = 0; v <= termYears; v += 5) xt.push(v);
  const endLabel = `Paid off at ${yrsMos(endMonths)}`;
  const label = `Balance with overpayments reaches zero after ${yrsMos(endMonths)}, against ${termYears} years without.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: "block" }}>
      {!compact && ticks.map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={y(v)} y2={y(v)} {...GRID} />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" {...AXIS}>{v ? gbpK(v) : "£0"}</text>
        </g>
      ))}
      <line x1={L} x2={R} y1={B} y2={B} style={{ stroke: "var(--line)" }} />
      {xt.map((v) => <text key={v} x={x(v)} y={B + 20} textAnchor={compact && v === 0 ? "start" : compact && v === termYears ? "end" : "middle"} {...AXIS}>{v === 0 ? "Now" : compact ? `${v} yrs` : `Year ${v}`}</text>)}
      {fixYears > 0 && fixYears < termYears && (
        <g>
          <line x1={x(fixYears)} x2={x(fixYears)} y1={T} y2={B} style={{ stroke: "var(--muted)" }} strokeDasharray="4 4" />
          <text x={x(fixYears) + 6} y={30} {...AXIS}>Fix ends</text>
        </g>
      )}
      <path d={gap} style={{ fill: "var(--accent)", fillOpacity: 0.12 }} />
      <path d={linePath(pts(base))} style={{ fill: "none", stroke: "var(--muted)", strokeWidth: 2, strokeOpacity: 0.7 }} />
      <path d={linePath(pts(over))} style={{ fill: "none", stroke: "var(--accent)", strokeWidth: 3 }} />
      <circle cx={x(endY)} cy={B} r={6} style={{ fill: "var(--accent)", stroke: "var(--surface)", strokeWidth: 2 }} />
      <text x={Math.min(x(endY) + 10, R - 4)} y={B - 10} textAnchor={x(endY) + 10 > R - 120 ? "end" : "start"} fontSize={13} fontWeight={700} style={{ fill: "var(--ink)" }}>{endLabel}</text>
      <text x={compact ? 230 : 548} y={compact ? 70 : 150} fontSize={12.5} style={{ fill: "var(--muted)" }}>Without overpaying</text>
    </svg>
  );
}
