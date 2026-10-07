import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const font = Schibsted_Grotesk({ subsets: ["latin"], weight: ["400", "500", "600", "700", "800"], variable: "--font-schibsted", display: "swap" });

export const metadata: Metadata = {
  title: { default: "HomeHunt", template: "%s · HomeHunt" },
  description: "A private home-buying journal for two: plan viewings, rate them on the doorstep and see where every home ranks.",
  applicationName: "HomeHunt",
  appleWebApp: { capable: true, title: "HomeHunt", statusBarStyle: "default" },
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#eef1ec" }, { media: "(prefers-color-scheme: dark)", color: "#0f1613" }], width: "device-width", initialScale: 1 };

// Applies a saved light/dark choice before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('hh.theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-GB" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
