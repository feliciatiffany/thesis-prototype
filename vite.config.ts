import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { copyFileSync } from "node:fs";
import { defineConfig } from "vite";

function spaFallback() {
  return {
    name: "spa-404",
    closeBundle() {
      copyFileSync("dist/index.html", "dist/404.html");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), spaFallback()],
});
