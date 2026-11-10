import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "cli",
          include: ["src/**/*.test.ts"],
          // These tests spawn real git and shell processes; on a busy machine one can take several seconds.
          testTimeout: 30_000,
          hookTimeout: 30_000,
          exclude: ["dist/**", "node_modules/**"],
        },
      },
      "app/vite.config.ts",
    ],
  },
});
