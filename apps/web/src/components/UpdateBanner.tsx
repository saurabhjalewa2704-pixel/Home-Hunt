"use client";
import { useEffect, useState } from "react";
import { checkForUpdate, dismissUpdate, openLatest, reloadFresh, useUpdate } from "@/lib/update-store";
import { THIS_BUILD } from "@/lib/update";
import { useStore } from "@/lib/store";

/** Looks for a newer build when the app opens, comes back to the front, regains a connection, and every 15 minutes. */
export function useUpdateWatcher() {
  useEffect(() => {
    const first = setTimeout(() => void checkForUpdate(), 3000);
    const every = setInterval(() => void checkForUpdate(), 15 * 60_000);
    const onVisible = () => document.visibilityState === "visible" && void checkForUpdate();
    const onOnline = () => void checkForUpdate();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
    };
  }, []);
}

/** "A newer version is ready": reload, or open the live address when this copy is on an old one. */
export function UpdateBanner() {
  const u = useUpdate();
  const { mode } = useStore();
  const [busy, setBusy] = useState(false);
  if (u.status !== "available" || u.dismissed || !u.decision) return null;
  const open = u.decision.action === "open";
  return (
    <div role="status" className="no-print fixed inset-x-0 top-0 z-50 flex flex-wrap items-center gap-x-4 gap-y-2 border-b px-4 py-3 pt-[max(env(safe-area-inset-top),12px)] text-sm shadow-md" style={{ background: "var(--info-bg)", color: "var(--info-fg)", borderColor: "var(--info-fg)" }}>
      <span className="min-w-[220px] flex-1 leading-5">
        {open ? (
          <>
            <strong>You're on an older address of HomeHunt.</strong> A newer version is live at its main address.
            {mode === "local" && " Your homes are saved in this browser at this address, so export them from Settings first, or they won't come with you."}
          </>
        ) : (
          <><strong>A new version of HomeHunt is ready.</strong> Reload to get it. Nothing you've saved is lost.</>
        )}
      </span>
      <span className="flex gap-2">
        <button className="btn btn-p !min-h-10" disabled={busy} onClick={() => { setBusy(true); if (open) openLatest(); else void reloadFresh(); }}>{open ? "Open the latest" : busy ? "Reloading…" : "Reload"}</button>
        <button className="btn !min-h-10" onClick={dismissUpdate}>Later</button>
      </span>
    </div>
  );
}

/** A manual "check now", with the answer written out. */
export function CheckForUpdates({ className }: { className?: string }) {
  const u = useUpdate();
  const [asked, setAsked] = useState(false);
  const text = !asked ? null : u.status === "checking" ? "Checking…" : u.status === "available" ? "A newer version is ready. See the bar at the top." : u.status === "error" ? "Couldn't check. Are you online?" : "You're on the latest version.";
  return (
    <span className={className}>
      <button className="btn !min-h-10" onClick={() => { setAsked(true); void checkForUpdate(); }}>Check for updates</button>
      {text && <span role="status" className="ml-3 text-sm text-muted">{text}</span>}
      <span className="mt-1 block text-xs text-muted">This is build {THIS_BUILD.build}.</span>
    </span>
  );
}
