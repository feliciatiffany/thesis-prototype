import { useEffect, useRef } from "react";
import { RestartButton } from "./RestartButton.tsx";
import { useStudy } from "../store/useStudy.ts";

const CELLS = [
  {
    title: "No mark",
    body: "The samples agreed, and a source supports the sentence. You can still open a source.",
  },
  {
    title: "Note after the sentence",
    body: "The samples agreed, but the sources do not back it. Read the note. “Sources disagree” and “no source confirms it” are different.",
  },
  {
    title: "Dotted underline",
    body: "The samples used different wording, and a source still has an answer. Open it to see both.",
  },
  {
    title: "Underline and ?",
    body: "The samples varied, and the sources do not confirm the sentence. Open it, then ask if you want.",
  },
];

export function Explainer() {
  const open = useStudy((state) => state.explainerOpen);
  const closeExplainer = useStudy((state) => state.closeExplainer);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeExplainer();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [open, closeExplainer]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-stone-900/40 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="explainer-title"
        className="w-full max-w-md rounded-2xl bg-white p-4 shadow-xl"
      >
        <h2 id="explainer-title" className="text-base font-medium">
          How to read these marks
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
          {CELLS.map((cell) => (
            <div key={cell.title} className="rounded-xl bg-stone-50 p-2">
              <p className="font-medium">{cell.title}</p>
              <p className="mt-1 text-stone-700">{cell.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            ref={closeRef}
            type="button"
            className="rounded-full border border-stone-400 px-3 py-1 text-sm"
            onClick={closeExplainer}
          >
            Close
          </button>
          <RestartButton />
        </div>
      </div>
    </div>
  );
}
