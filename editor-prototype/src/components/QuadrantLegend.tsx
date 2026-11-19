import { useState } from "react";
import { QUADRANT_LABEL } from "../config.ts";
import { QuadrantIcon } from "./QuadrantIcon.tsx";
import type { Quadrant } from "../types.ts";

const CELLS: Quadrant[] = [
  "solid",
  "confidently_wrong",
  "unstable_sourced",
  "speculation",
];

const CHROME: Record<Quadrant, string> = {
  solid: "border-stone-400 bg-stone-100 text-stone-800",
  confidently_wrong: "border-red-800 bg-red-50 text-red-950",
  speculation: "border-amber-800 bg-amber-50 text-amber-950",
  unstable_sourced: "border-blue-800 bg-blue-50 text-blue-950",
};

export function QuadrantLegend({
  current,
  onOpen,
}: {
  current: Quadrant;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-md border border-stone-300 bg-white" aria-label="Signal legend">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-stone-900"
        aria-expanded={open}
        onClick={() => {
          const next = !open;
          setOpen(next);
          if (next) onOpen();
        }}
      >
        <span>What does this mean?</span>
        <span className="text-stone-600">{open ? "Hide" : "Show"}</span>
      </button>
      {open ? (
        <div className="border-t border-stone-200 px-3 py-3">
          <p className="text-sm text-stone-700">
            Consistency is the vertical axis. Source support is the horizontal axis. The cell
            marked “This claim” is the one open now.
          </p>
          <div className="mt-3 grid grid-cols-[auto_1fr_1fr] gap-2">
            <div />
            <p className="text-center text-xs font-medium tracking-wide text-stone-600 uppercase">
              Supported by sources
            </p>
            <p className="text-center text-xs font-medium tracking-wide text-stone-600 uppercase">
              Not backed by sources
            </p>
            <p className="flex items-center text-xs font-medium tracking-wide text-stone-600 uppercase [writing-mode:vertical-rl] rotate-180">
              High consistency
            </p>
            {CELLS.slice(0, 2).map((quadrant) => (
              <LegendCell key={quadrant} quadrant={quadrant} current={current} />
            ))}
            <p className="flex items-center text-xs font-medium tracking-wide text-stone-600 uppercase [writing-mode:vertical-rl] rotate-180">
              Low consistency
            </p>
            {CELLS.slice(2).map((quadrant) => (
              <LegendCell key={quadrant} quadrant={quadrant} current={current} />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function LegendCell({ quadrant, current }: { quadrant: Quadrant; current: Quadrant }) {
  const here = quadrant === current;
  return (
    <div
      className={`rounded-md border px-2 py-2 text-sm ${CHROME[quadrant]} ${here ? "ring-2 ring-stone-900" : ""}`}
      aria-current={here ? "true" : undefined}
    >
      <p className="flex items-start gap-1.5">
        <QuadrantIcon quadrant={quadrant} />
        <span>{QUADRANT_LABEL[quadrant]}</span>
      </p>
      {here ? <p className="mt-1 font-medium">This claim</p> : null}
    </div>
  );
}
