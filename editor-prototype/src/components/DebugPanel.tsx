import { useState } from "react";
import { useStudy } from "../context/StudyContext.tsx";
import { deriveClaim } from "../lib/quadrant.ts";

export function DebugPanel() {
  const study = useStudy();
  const [open, setOpen] = useState(true);
  if (!study.debug) return null;

  const task = study.currentTask;
  const recent = [...study.state.events].reverse().slice(0, 40);

  return (
    <aside className="fixed right-4 bottom-4 z-40 w-[22rem] max-w-[calc(100vw-2rem)] rounded-md border border-stone-400 bg-white shadow-lg">
      <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2">
        <p className="text-sm font-medium text-stone-900">Debug</p>
        <button
          type="button"
          className="text-sm text-stone-700 underline"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide" : "Show"}
        </button>
      </div>
      {open ? (
        <div className="max-h-[70vh] space-y-3 overflow-y-auto px-3 py-3 text-sm text-stone-800">
          <p>
            {study.state.started
              ? `Mode ${study.state.mode}. Condition ${study.currentCondition}${
                  study.state.mode === "pilot" ? " for this task" : ""
                }. Session label ${study.state.sessionCondition}.`
              : "Session not started."}
          </p>
          <p>
            {study.state.assignedFromHash
              ? "Condition was assigned from the participant ID hash mod 4."
              : study.conditionFromUrl
                ? `Condition ${study.conditionFromUrl} came from the URL.`
                : "Condition is not fixed yet."}
          </p>
          <p>Order: {study.state.taskOrder.join(" → ") || "not started"}</p>
          {study.warnings.length > 0 ? (
            <ul className="list-disc pl-4 text-amber-950">
              {study.warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          {task ? (
            <ul className="space-y-1">
              {task.claims.map((claim) => {
                const derived = deriveClaim(claim);
                const runtime = study.state.claimStates[claim.id];
                return (
                  <li key={claim.id}>
                    {claim.id}: {derived.quadrant}, {claim.verdict}
                    {runtime?.handled ? ", handled" : ", open"}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p>No task open.</p>
          )}
          <button
            type="button"
            className="rounded-md border border-stone-400 px-2 py-1"
            onClick={() => {
              if (window.confirm("Clear this session and return to the start screen?")) {
                study.reset();
              }
            }}
          >
            Reset session
          </button>
          <div>
            <p className="font-medium text-stone-900">Event log</p>
            <ol className="mt-1 space-y-1 font-mono text-xs">
              {recent.length === 0 ? <li>No events yet.</li> : null}
              {recent.map((event, index) => (
                <li key={`${event.ts}-${index}`}>
                  {event.type}
                  {event.claim_id ? ` ${event.claim_id}` : ""} · {event.t}ms
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
