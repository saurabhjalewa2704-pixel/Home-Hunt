"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { gbp } from "@/lib/format";
import { activeConfig } from "@/lib/derive";
import { store, useStore } from "@/lib/store";
import { IAgents, IBoard, ICompare, ILogo, IPlus, ISchedule, ISettings } from "./icons";
import { Avatar, cx } from "./ui";

const NAV = [
  { href: "/", label: "Board", icon: IBoard },
  { href: "/schedule", label: "Schedule", icon: ISchedule },
  { href: "/compare", label: "Compare", icon: ICompare },
  { href: "/agents", label: "Agents", icon: IAgents },
  { href: "/settings", label: "Settings", icon: ISettings },
];

function isOn(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/property") : path.startsWith(href);
}

export function SyncBadge({ className }: { className?: string }) {
  const { sync, pending, mode } = useStore();
  const offline = sync === "offline" || pending > 0;
  const text = offline ? `Saved on this phone${pending ? `, ${pending} waiting to sync` : ""}` : mode === "local" ? "Saved on this device" : "Synced";
  return (
    <span className={cx("inline-flex items-center gap-1.5 text-[13px] text-muted", className)} role="status">
      <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: offline ? "var(--amber)" : "var(--accent)" }} />
      {text}
    </span>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <main className="mx-auto flex min-h-dvh max-w-[520px] flex-col justify-center gap-5 px-6 py-10">{children}</main>;
}

export function Shell({ children }: { children: ReactNode }) {
  const s = useStore();
  const path = usePathname();
  const router = useRouter();

  useEffect(() => {
    void store.start();
  }, []);
  useEffect(() => {
    if (s.status === "needs-auth") router.replace("/login");
  }, [s.status, router]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);

  if (s.status === "loading" || s.status === "needs-auth") {
    return (
      <Centered>
        <div className="flex items-center gap-3"><ILogo /><span className="text-xl font-extrabold">HomeHunt</span></div>
        <p className="m-0 text-muted" role="status">Opening your board…</p>
      </Centered>
    );
  }
  if (s.status === "error") {
    return (
      <Centered>
        <h1 className="m-0 text-2xl font-extrabold">We couldn't open HomeHunt</h1>
        <p className="m-0 text-muted">{s.error}</p>
        <button className="btn btn-p w-fit" onClick={() => window.location.reload()}>Try again</button>
      </Centered>
    );
  }
  if (s.status === "denied") {
    return (
      <Centered>
        <h1 className="m-0 text-2xl font-extrabold">This account isn't part of a household</h1>
        <p className="m-0 text-muted">HomeHunt is private to two people. Sign in with the email address that was invited, or ask whoever set it up to add you.</p>
        <button className="btn w-fit" onClick={() => void store.signOut()}>Sign out</button>
      </Centered>
    );
  }
  if (s.status === "choose") {
    return (
      <Centered>
        <div className="flex items-center gap-3"><ILogo /><span className="text-xl font-extrabold">HomeHunt</span></div>
        <h1 className="m-0 text-[28px] leading-8 font-extrabold tracking-[-0.02em]">Who's looking today?</h1>
        <p className="m-0 text-muted">Demo mode: everything is saved in this browser, with sample homes to explore. Open a second tab as the other buyer to see private ratings in action.</p>
        <div className="flex flex-col gap-3">
          {s.data.members.map((m) => (
            <button key={m.id} className="btn btn-lg justify-start gap-3" onClick={() => store.chooseMe(m.id)}>
              <Avatar member={m} size={30} />{m.display_name}
            </button>
          ))}
        </div>
      </Centered>
    );
  }

  const me = s.data.members.find((m) => m.id === s.me);
  const budget = activeConfig(s.data).config.budget;
  const fullscreen = /^\/property\/[^/]+\/rate/.test(path);

  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded focus:bg-surface focus:p-2">Skip to content</a>
      <aside className="sticky top-0 hidden h-dvh w-[240px] flex-none flex-col gap-7 border-r border-line px-5 py-7 md:flex">
        <Link href="/" className="flex items-center gap-2.5 px-3 text-ink no-underline">
          <ILogo /><span className="text-xl font-extrabold tracking-[-0.02em]">HomeHunt</span>
        </Link>
        <nav aria-label="Main" className="flex flex-col gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={cx("nav", isOn(path, n.href) && "nav-on")} aria-current={isOn(path, n.href) ? "page" : undefined}>
              <n.icon />{n.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-col gap-1.5 rounded-xl p-4" style={{ background: "var(--line-2)" }}>
          <span className="text-[13px] text-muted">Budget limit</span>
          <span className="text-[22px] font-bold">{gbp(budget)}</span>
          <span className="text-[13px] leading-[18px] text-muted">Homes listed above it are ruled out.</span>
        </div>
        <div className="mt-auto flex flex-col gap-3 px-3">
          <SyncBadge />
          <div className="flex items-center gap-2.5">
            <Avatar member={me} size={30} />
            <span className="text-sm text-ink-2">{me?.display_name}</span>
            <button className="ml-auto text-[13px] text-muted underline" onClick={() => void store.signOut()}>Switch</button>
          </div>
        </div>
      </aside>

      <main id="main" className={cx("min-w-0 flex-1", fullscreen ? "" : "pb-[104px] md:pb-16")}>{children}</main>

      {!fullscreen && (
        <nav aria-label="Main" className="tabbar fixed inset-x-0 bottom-0 z-30 flex items-center border-t border-line bg-surface px-2 pt-1 pb-[max(env(safe-area-inset-bottom),12px)] md:hidden">
          <Link href="/" aria-current={isOn(path, "/") ? "page" : undefined}><IBoard />Board</Link>
          <Link href="/schedule" aria-current={isOn(path, "/schedule") ? "page" : undefined}><ISchedule />Schedule</Link>
          <Link href="/add" aria-label="Add a home" className="!min-h-14 !flex-none !w-14 mx-1.5 rounded-2xl" style={{ background: "var(--accent)", color: "var(--on-accent)" }}><IPlus width={24} height={24} /></Link>
          <Link href="/compare" aria-current={isOn(path, "/compare") ? "page" : undefined}><ICompare />Compare</Link>
          <Link href="/settings" aria-current={isOn(path, "/settings") ? "page" : undefined}><ISettings />Settings</Link>
        </nav>
      )}
      {s.error && (
        <div role="alert" className="fixed top-3 left-1/2 z-50 flex max-w-[92vw] -translate-x-1/2 items-center gap-3 rounded-xl px-4 py-3 text-sm" style={{ background: "var(--danger-bg)", color: "var(--danger-fg)", border: "1px solid var(--danger)" }}>
          {s.error}
          <button className="font-bold underline" onClick={() => store.clearError()}>Dismiss</button>
        </div>
      )}
    </div>
  );
}
