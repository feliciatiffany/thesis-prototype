import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { defineConfig, loadEnv } from "vite";
import type { Plugin } from "vite";
import { analyze } from "./server/analyze.ts";
import { ask } from "./server/ask.ts";
import { read, recheck, recommend } from "./server/trail.ts";

function spaFallback() {
  return {
    name: "spa-404",
    closeBundle() {
      copyFileSync("dist/index.html", "dist/404.html");
    },
  };
}

/** JSON POST endpoints on the dev server: the canvas asks questions, the source map analyzes sources. */
function apiRoutes(): Plugin {
  const routes: Record<string, (body: never) => Promise<unknown>> = {
    "/api/ask": ask,
    "/api/analyze": analyze,
    "/api/recheck": recheck,
    "/api/recommend": recommend,
    "/api/read": read,
  };
  return {
    name: "api-routes",
    configureServer(server) {
      for (const [path, handler] of Object.entries(routes)) {
        server.middlewares.use(path, (req, res) => {
          if (req.method !== "POST") {
            res.statusCode = 405;
            res.end();
            return;
          }
          let raw = "";
          req.on("data", (chunk) => (raw += chunk));
          req.on("end", async () => {
            let result;
            try {
              result = await handler(JSON.parse(raw) as never);
            } catch {
              result = { error: "Bad request." };
            }
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(result));
          });
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY from .env.local, for the dev server only. Never exposed to the page.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  return { plugins: [react(), tailwindcss(), spaFallback(), apiRoutes()] };
});
