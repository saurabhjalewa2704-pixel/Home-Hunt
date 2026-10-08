/** @type {import('next').NextConfig} */
const config = {
  transpilePackages: ["@homehunt/scoring", "@homehunt/importers", "@homehunt/geo"],
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
