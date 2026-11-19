import { IconCheck, IconGap, IconX } from "./Icons.tsx";
import { verdictDetail, verdictLabel } from "../lib/labels.ts";
import type { Verdict } from "../types.ts";

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const Icon = verdict === "SUPPORTED" ? IconCheck : verdict === "REFUTED" ? IconX : IconGap;
  return (
    <div className="rounded-md border border-stone-400 bg-white px-3 py-2 text-stone-800">
      <p className="flex items-center gap-2 font-medium">
        <Icon />
        <span>{verdictLabel(verdict)}</span>
      </p>
      <p className="mt-1 text-sm">{verdictDetail(verdict)}</p>
    </div>
  );
}
