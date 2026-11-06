import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vitest/config";

const afkUrl = process.env.AFK_URL;
const afkToken = process.env.AFK_TOKEN;

function devSession(): Plugin {
  return {
    name: "afk-dev-session",
    apply: "serve",
    transformIndexHtml: html => afkToken ? html.replace("/* AFK_SESSION */", `window.afkToken=${JSON.stringify(afkToken)};`) : html,
  };
}

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "/next/",
  publicDir: false,
  plugins: [react(), devSession()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: {
    outDir: fileURLToPath(new URL("../web/next", import.meta.url)),
    emptyOutDir: true,
    assetsDir: "assets",
  },
  server: afkUrl
    ? {
        proxy: {
          "/api": { target: afkUrl, changeOrigin: true, configure: proxy => { proxy.on("proxyReq", request => request.removeHeader("origin")); } },
          "/assets": { target: afkUrl, changeOrigin: true },
          "/favicon.svg": { target: afkUrl, changeOrigin: true },
        },
      }
    : {},
  test: {
    name: "app",
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test/setup.ts"],
  },
});
