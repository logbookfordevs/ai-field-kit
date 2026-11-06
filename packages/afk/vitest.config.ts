import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "cli",
          include: ["src/**/*.test.ts"],
          exclude: ["dist/**", "node_modules/**"],
        },
      },
      "app/vite.config.ts",
    ],
  },
});
