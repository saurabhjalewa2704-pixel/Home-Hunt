/** @type {import('next').NextConfig} */
// Shown in the phone menu so you can tell which build a device is running.
const buildId = (process.env.VERCEL_GIT_COMMIT_SHA ?? "local").slice(0, 7);
// The live app's stable address, so a copy opened at an older deployment address can find and offer the newest version.
// Set APP_CANONICAL_URL to override (for example a custom domain); Vercel provides the production domain itself.
const canonical = (process.env.APP_CANONICAL_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "")).replace(/\/+$/, "");
const config = {
  env: { NEXT_PUBLIC_BUILD_ID: buildId, NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(), NEXT_PUBLIC_CANONICAL_URL: canonical },
  transpilePackages: ["@homehunt/scoring", "@homehunt/importers", "@homehunt/geo", "@homehunt/mortgage"],
  poweredByHeader: false,
  // pdfjs-dist can optionally use a native canvas on the server; the browser build never needs it.
  webpack(config) {
    config.resolve.alias = { ...config.resolve.alias, canvas: false };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
    ];
  },
};
export default config;
