import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// API-010 — integration tests against a real PostgreSQL (Docker, base motor_irm_test).
export default defineConfig({
  resolve: { alias: { "~": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    environment: "node",
    globalSetup: ["./tests/global-setup.ts"],
    setupFiles: ["./tests/setup-env.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
