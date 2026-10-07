"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ILogo } from "@/components/icons";
import { hasSupabase, supabaseBrowser } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasSupabase) router.replace("/");
    else supabaseBrowser().auth.getSession().then(({ data }) => data.session && router.replace("/"));
    const q = new URLSearchParams(window.location.search).get("error");
    if (q) setError("That sign-in link didn't work. It may have expired, so ask for a new one.");
  }, [router]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || busy) return;
    setBusy(true);
    setError(null);
    // The same message is shown whether or not the address is invited, so the page never reveals who is.
    const { error: err } = await supabaseBrowser().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: false, emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err && /rate|too many|seconds/i.test(err.message)) return setError("Too many tries. Wait a minute, then ask for a new link.");
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-[440px] flex-col justify-center gap-6 px-6 py-10">
      <div className="flex items-center gap-3"><ILogo size={36} /><span className="text-2xl font-extrabold tracking-[-0.02em]">HomeHunt</span></div>
      {sent ? (
        <div role="status" className="flex flex-col gap-3">
          <h1 className="m-0 text-[28px] leading-8 font-extrabold tracking-[-0.02em]">Check your email</h1>
          <p className="m-0 text-muted">If {email} is one of the two invited addresses, a sign-in link is on its way. Open it on this device. The link works once and expires soon.</p>
          <button className="btn w-fit" onClick={() => setSent(false)}>Use a different address</button>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <h1 className="m-0 text-[28px] leading-8 font-extrabold tracking-[-0.02em]">Sign in</h1>
          <p className="m-0 text-muted">No password needed. We'll email you a link.</p>
          <div className="flex flex-col gap-1.5"><label className="lab" htmlFor="email">Email address</label>
            <input id="email" className="inp !min-h-[52px] !text-base" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          {error && <p role="alert" className="m-0 text-sm" style={{ color: "var(--danger)" }}>{error}</p>}
          <button className="btn btn-p btn-lg" disabled={busy || !email.trim()}>{busy ? "Sending…" : "Email me a sign-in link"}</button>
        </form>
      )}
    </main>
  );
}
