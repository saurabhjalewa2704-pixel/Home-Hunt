"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { SetupBanner } from "@/components/mortgage/bits";
import { useStore } from "@/lib/store";

const TABS = [
  { href: "/mortgage", label: "Calculator" },
  { href: "/mortgage/scenarios", label: "Scenarios" },
  { href: "/mortgage/overpayments", label: "Overpayments" },
];

export default function MortgageLayout({ children }: { children: ReactNode }) {
  const path = usePathname().replace(/\/$/, "") || "/";
  const { missingTables } = useStore();
  const missing = missingTables.some((t) => t === "mortgage_scenarios" || t === "overpayment_plans" || t === "mortgage_settings");
  return (
    <div className="mx-auto flex max-w-[1180px] flex-col gap-5 px-4 pt-6 pb-10 md:px-10 md:pt-9">
      <header className="flex flex-col gap-3.5">
        <h1 className="m-0 text-[30px] leading-[34px] font-extrabold tracking-[-0.025em] md:text-[40px] md:leading-[44px]">Mortgage</h1>
        <nav aria-label="Mortgage sections" className="no-print flex overflow-x-auto border-b border-line">
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className="mtab" aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>
          ))}
        </nav>
      </header>
      <SetupBanner missing={missing} />
      {children}
    </div>
  );
}
