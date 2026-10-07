import type { SVGProps } from "react";

const base = (p: SVGProps<SVGSVGElement>, size = 20) => ({
  width: size,
  height: size,
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true as const,
  ...p,
});

export const IBoard = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M3 4h14M3 10h14M3 16h9" /></svg>
);
export const ISchedule = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="4" width="14" height="13" rx="2" /><path d="M3 8h14M7 2v4M13 2v4" /></svg>
);
export const ICompare = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><rect x="3" y="3" width="6" height="14" rx="1.5" /><rect x="11" y="3" width="6" height="14" rx="1.5" /></svg>
);
export const IAgents = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><circle cx="10" cy="7" r="3.5" /><path d="M3.5 17c1-3.2 3.4-4.8 6.5-4.8s5.5 1.6 6.5 4.8" /></svg>
);
export const ISettings = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p)}><path d="M4 6h7M15 6h1M4 14h1M9 14h7" /><circle cx="13" cy="6" r="2" /><circle cx="7" cy="14" r="2" /></svg>
);
export const IPlus = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 18)} viewBox="0 0 18 18" strokeWidth={2}><path d="M9 3v12M3 9h12" /></svg>
);
export const IChevron = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 18)} viewBox="0 0 18 18" strokeWidth={2}><path d="M7 4l5 5-5 5" /></svg>
);
export const IBack = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 18)} viewBox="0 0 16 16" strokeWidth={2}><path d="M10 3L5 8l5 5" /></svg>
);
export const IDown = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 14)} viewBox="0 0 14 14" strokeWidth={1.6}><path d="M3 5l4 4 4-4" /></svg>
);
export const IWarn = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 13)} viewBox="0 0 14 14" strokeWidth={1.8}><path d="M7 1.5L13 12.5H1z" /><path d="M7 6v3" /></svg>
);
export const IPhone = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 16)} viewBox="0 0 16 16" strokeWidth={1.6}><path d="M3 2.5h3l1.2 3-1.7 1.2a8 8 0 003.8 3.8l1.2-1.7 3 1.2v3c0 .6-.4 1-1 1A11.5 11.5 0 012 3.5c0-.6.4-1 1-1z" /></svg>
);
export const IPin = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 16)} viewBox="0 0 16 16" strokeWidth={1.6}><path d="M8 14.5s-5-4.6-5-8.3a5 5 0 0110 0c0 3.7-5 8.3-5 8.3z" /><circle cx="8" cy="6.3" r="1.8" /></svg>
);
export const ICheck = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 16)} viewBox="0 0 16 16" strokeWidth={1.8}><path d="M2 8.5l3.5 3.5L14 4" /></svg>
);
export const IWalk = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 16)} viewBox="0 0 16 16" strokeWidth={1.6}><circle cx="8.5" cy="2.5" r="1.5" /><path d="M7 6l-2 4 2 1 1 4M7 6l3 1 1 3M7 6l1 4" /></svg>
);
export const ITrain = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 16)} viewBox="0 0 16 16" strokeWidth={1.6}><rect x="3" y="2" width="10" height="10" rx="2" /><path d="M5 14l1-2M11 14l-1-2M3 8h10" /></svg>
);
export const IPinned = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 14)} viewBox="0 0 16 16" strokeWidth={1.6}><path d="M9.5 1.5l5 5-2 .5-2.5 2.5.5 3-1 1-3-3-4.5 4.5M7 4l-2 .5-1 1 6 6" /></svg>
);
export const IDoc = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 22)} viewBox="0 0 22 22"><path d="M6 3h7l4 4v12H6z" /><path d="M13 3v4h4M9 11h5M9 14h5" /></svg>
);
export const IEdit = (p: SVGProps<SVGSVGElement>) => (
  <svg {...base(p, 22)} viewBox="0 0 22 22"><path d="M4 18l1-4L15 4l3 3L8 17z" /></svg>
);
export const ILogo = ({ size = 30 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
    <rect x="1" y="1" width="28" height="28" rx="8" fill="#1E5B47" />
    <path d="M8 21V13.5L15 8l7 5.5V21" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
    <path d="M13 21v-4h4v4" stroke="#fff" strokeWidth="2" />
  </svg>
);
export const IHouse = ({ w = 120, h = 84 }: { w?: number; h?: number }) => (
  <svg viewBox="0 0 120 84" width={w} height={h} fill="none" stroke="currentColor" strokeOpacity="0.32" strokeWidth="1.5" aria-hidden="true" preserveAspectRatio="xMidYMax meet">
    <path d="M18 84V40L42 22L66 40V84M66 84V36L86 22L106 36V84" />
    <rect x="30" y="50" width="10" height="12" />
    <rect x="46" y="50" width="10" height="12" />
    <path d="M38 84V70h8v14" />
    <rect x="76" y="46" width="20" height="12" />
    <path d="M80 84V68h12v16" />
  </svg>
);
