import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: "standalone",
  // cacheComponents/partialPrefetching (Next 16's experimental PPR-style prerendering)
  // require every page touching auth()/cookies()/DB reads to opt in via Suspense or
  // "use cache" — nearly every route here is session- or DB-dependent by design, so
  // standard per-request dynamic rendering is the right model for this app, not static
  // prerendering with carved-out dynamic holes.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
