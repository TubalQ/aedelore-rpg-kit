import { defineConfig } from "vitest/config";
import { resolve } from "path";

// Enhetstester (domän/scheman = ren TS, ingen Next-runtime). Kör med `npm test`.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": resolve(__dirname, "src") },
  },
});
