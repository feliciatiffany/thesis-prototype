import { suggestedActionIds } from "../lib/labels.ts";
import type { Condition, HandlingAction, Quadrant, Verdict } from "../types.ts";

const ACTIONS: { id: HandlingAction; label: string }[] = [
  { id: "keep", label: "Keep" },
  { id: "delete", label: "Delete" },
  { id: "hedge", label: "Hedge" },
  { id: "rewrite", label: "Rewrite" },
  { id: "use_source", label: "Use source wording" },
];

export function ActionBar({
  condition,
  quadrant,
  verdict,
  hasSourceWording,
  flagged,
  onAction,
  onSearch,
  onFlag,
}: {
  condition: Condition;
  quadrant: Quadrant;
  verdict: Verdict;
  hasSourceWording: boolean;
  flagged: boolean;
  onAction: (action: HandlingAction) => void;
  onSearch: () => void;
  onFlag: () => void;
}) {
  const suggested = new Set(suggestedActionIds(condition, quadrant, verdict));
  const assist =
    condition === "D" && quadrant === "unstable_sourced" && hasSourceWording;

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Claim actions">
      {ACTIONS.filter((action) => action.id !== "use_source" || hasSourceWording).map(
        (action) => {
          const isSuggested = suggested.has(action.id);
          const emphasized = assist && action.id === "use_source";
          const label = emphasized
            ? "Replace with source wording"
            : isSuggested
              ? `Suggested: ${action.label}`
              : action.label;
          return (
            <button
              key={action.id}
              type="button"
              onClick={() => onAction(action.id)}
              className={buttonClass(emphasized, isSuggested)}
            >
              {label}
            </button>
          );
        },
      )}
      <button
        type="button"
        onClick={onSearch}
        className={buttonClass(false, suggested.has("search"))}
      >
        {suggested.has("search") ? "Suggested: Search further" : "Search further"}
      </button>
      <button type="button" onClick={onFlag} aria-pressed={flagged} className={buttonClass(false, false)}>
        {flagged ? "Unflag" : "Flag for later"}
      </button>
    </div>
  );
}

function buttonClass(emphasized: boolean, suggested: boolean): string {
  if (emphasized) {
    return "rounded-md border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-700";
  }
  if (suggested) {
    return "rounded-md border-2 border-amber-800 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100";
  }
  return "rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-900 hover:bg-stone-100";
}
