import { QUADRANT_LABEL, QUADRANT_SHORT } from "../config.ts";
import { actionLabel, evidenceIsRequired, verdictDetail, verdictLabel } from "../lib/labels.ts";
import { deriveClaim } from "../lib/quadrant.ts";
import type { ClaimRuntime, Condition, Task } from "../types.ts";
import { CoverageBar } from "./CoverageBar.tsx";
import { QuadrantIcon } from "./QuadrantIcon.tsx";
import { IconCheck, IconGap, IconLock, IconX } from "./Icons.tsx";

const QUADRANT_CHIP = {
  solid: "border-stone-400 bg-stone-100 text-stone-800",
  confidently_wrong: "border-red-800 bg-red-50 text-red-950",
  speculation: "border-amber-800 bg-amber-50 text-amber-950",
  unstable_sourced: "border-blue-800 bg-blue-50 text-blue-950",
} as const;

export function AnswerPane({
  task,
  condition,
  claimStates,
  selectedClaimId,
  onSelect,
  onOpenPassage,
}: {
  task: Task;
  condition: Condition;
  claimStates: Record<string, ClaimRuntime>;
  selectedClaimId: string | null;
  onSelect: (claimId: string) => void;
  onOpenPassage: (passageId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-[68ch] px-10 py-8">
      <p className="text-sm font-medium tracking-wide text-stone-600 uppercase">Question</p>
      <h1 className="reading mt-2 text-2xl leading-snug text-stone-950">{task.question}</h1>
      <p className="mt-4 rounded-md border border-stone-300 bg-white px-4 py-3 text-stone-800">
        You're preparing this answer to share with a friend. Make sure it's accurate. Edit, remove
        or keep each claim.
      </p>
      <h2 className="mt-8 text-sm font-medium tracking-wide text-stone-600 uppercase">Answer</h2>
      <p className="reading mt-3 text-stone-950">
        {task.claims.map((claim, index) => {
          const runtime = claimStates[claim.id];
          const derived = deriveClaim(claim);
          const selected = selectedClaimId === claim.id;
          const locked =
            evidenceIsRequired(condition, derived.quadrant) && !runtime?.handled;
          const status = runtime?.action ? actionLabel(runtime.action) : "";
          const signal =
            condition === "D"
              ? `${QUADRANT_LABEL[derived.quadrant]}. ${verdictDetail(derived.verdict)}`
              : condition === "C"
                ? `${verdictLabel(derived.verdict)}. ${verdictDetail(derived.verdict)}`
                : condition === "B"
                  ? `${claim.consistency.agree} of ${claim.consistency.total} samples say this`
                  : "";
          const name = [claim.text, signal, status, locked ? "Locked" : "", runtime?.flagged ? "Flagged for later" : ""]
            .filter(Boolean)
            .join(". ");
          return (
            <span key={claim.id}>
              {index > 0 ? " " : null}
              <button
                type="button"
                aria-pressed={selected}
                aria-label={name}
                onClick={() => onSelect(claim.id)}
                className={`inline rounded-sm px-0.5 text-left underline decoration-1 underline-offset-[5px] transition-colors duration-150 ${
                  selected
                    ? "bg-white decoration-stone-900 decoration-2"
                    : runtime?.handled
                      ? "decoration-stone-500"
                      : "decoration-dotted decoration-stone-500"
                }`}
              >
                <ClaimMarker condition={condition} claim={derived} locked={locked} />
                <span className={runtime?.action === "delete" ? "line-through" : undefined}>
                  {runtime?.action && runtime.action !== "keep" && runtime.action !== "delete"
                    ? runtime.finalText
                    : claim.text}
                </span>
                {status ? (
                  <span className="ml-1 align-middle text-sm font-sans font-medium text-stone-700 no-underline">
                    {status}
                  </span>
                ) : null}
              </button>
            </span>
          );
        })}
      </p>

      {condition === "A" ? (
        <section className="mt-10 border-t border-stone-300 pt-6" aria-label="Sources">
          <h2 className="text-lg font-medium text-stone-900">Sources</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {task.passages.map((passage) => (
              <li key={passage.id}>
                <button
                  type="button"
                  onClick={() => onOpenPassage(passage.id)}
                  className="text-left text-stone-900 underline decoration-stone-400 underline-offset-4"
                >
                  {passage.source_title}
                </button>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {condition === "C" || condition === "D" ? <CoverageBar task={task} /> : null}
    </div>
  );
}

function ClaimMarker({
  condition,
  claim,
  locked,
}: {
  condition: Condition;
  claim: ReturnType<typeof deriveClaim>;
  locked: boolean;
}) {
  if (condition === "B") {
    return (
      <span className="mr-1 inline-flex items-center rounded border border-stone-400 bg-white px-1.5 py-0.5 align-middle font-sans text-sm font-medium text-stone-800 no-underline">
        {claim.consistency.agree} of {claim.consistency.total}
      </span>
    );
  }
  if (condition === "C") {
    const Icon = claim.verdict === "SUPPORTED" ? IconCheck : claim.verdict === "REFUTED" ? IconX : IconGap;
    return (
      <span className="mr-1 inline-flex items-center gap-1 rounded border border-stone-400 bg-white px-1.5 py-0.5 align-middle font-sans text-sm font-medium text-stone-800 no-underline">
        <Icon />
        {verdictLabel(claim.verdict)}
        <span className="text-stone-600">· {verdictDetail(claim.verdict)}</span>
      </span>
    );
  }
  if (condition === "D") {
    const extra =
      claim.verdict === "SUPPORTED" ? "" : ` · ${verdictDetail(claim.verdict)}`;
    return (
      <span
        className={`mr-1 inline-flex items-center gap-1 rounded border px-1.5 py-0.5 align-middle font-sans text-sm font-medium no-underline ${QUADRANT_CHIP[claim.quadrant]}`}
      >
        <QuadrantIcon quadrant={claim.quadrant} />
        {locked ? <IconLock /> : null}
        {QUADRANT_SHORT[claim.quadrant]}
        {extra}
        {locked ? " · Locked" : ""}
      </span>
    );
  }
  return null;
}
