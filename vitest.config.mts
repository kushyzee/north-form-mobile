import { fileURLToPath } from "node:url"

import { defineConfig } from "vitest/config"

/**
 * Vitest configuration.
 *
 * The suite covers the pure API client: request shapes, query-parameter
 * encoding, response validation and error normalisation. All of that is plain
 * TypeScript with no React Native imports, so it runs in a Node environment —
 * no jsdom and no Metro transform are needed.
 *
 * `@/*` is resolved the same way `tsconfig.json` defines it, so tests import
 * modules exactly as application code does.
 *
 * `.mts` so this loads as ESM regardless of the package's module type.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".expo/**", "android/**", "dist/**"],
  },
})