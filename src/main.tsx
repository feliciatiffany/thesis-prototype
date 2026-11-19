import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { signalTheme } from "./theme.ts";
import "./index.css";

function paintSignals(mode: "light" | "dark") {
  const tokens = signalTheme[mode];
  const root = document.documentElement;
  root.dataset.theme = mode;
  root.style.setProperty("--agree", tokens.agree);
  root.style.setProperty("--disagree", tokens.disagree);
  root.style.setProperty("--absent", tokens.absent);
  root.style.setProperty("--src-support", tokens.srcSupport);
  root.style.setProperty("--src-refute", tokens.srcRefute);
  root.style.setProperty("--src-none", tokens.srcNone);
  root.style.setProperty("--risk", tokens.risk);
}

const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
const paint = () => paintSignals(colorScheme.matches ? "dark" : "light");
paint();
colorScheme.addEventListener("change", paint);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
