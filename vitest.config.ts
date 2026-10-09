import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    server: {
      deps: {
        // Force next-auth through Vite's resolver (see alias below) instead of
        // Node's native ESM loader, which can't resolve its extension-less
        // `import ... from "next/server"` against Next 16's exports-less package.json.
        inline: [/next-auth/],
      },
    },
  },
  resolve: {
    alias: [
      { find: "@", replacement: path.resolve(__dirname, "src") },
      // next-auth@5 beta's lib/env.js does `import ... from "next/server"` with no
      // extension; Next 16's package.json has no "exports" map, so Node's strict ESM
      // resolver (which Vitest's default node-native resolution follows) can't find
      // it without an explicit file extension. Next's own bundler is permissive about
      // this, so this only ever surfaces under a test runner, not `next dev`/`build`.
      { find: /^next\/server$/, replacement: "next/server.js" },
    ],
  },
});
