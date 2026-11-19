import { useState } from "react";
import { readDelay, readStudyParams } from "../lib/assignment.ts";
import { ANNOTATION_DELAY_MS } from "../config.ts";
import { tutorialScenario } from "../data/tutorial.ts";
import { scenarioById } from "../lib/data.ts";
import { computeQuadrant } from "../lib/quadrant.ts";
import { useStudy } from "../store/useStudy.ts";

export function DebugPanel() {
  const [collapsed, setCollapsed] = useState(true);
  const started = useStudy((state) => state.started);
  const pid = useStudy((state) => state.pid);
  const phase = useStudy((state) => state.phase);
  const order = useStudy((state) => state.scenarioOrder);
  const index = useStudy((state) => state.scenarioIndex);
  const conditions = useStudy((state) => state.scenarioConditions);
  const delayMs = useStudy((state) => state.delayMs);
  const messages = useStudy((state) => state.messages);
  const events = useStudy((state) => state.events);
  const lastRoute = useStudy((state) => state.lastRoute);
  const reset = useStudy((state) => state.reset);
  const params = readStudyParams();
  const scenarioId = phase === "tutorial" ? "tutorial" : (order[index] ?? "");
  const scenario = scenarioId === "tutorial" ? tutorialScenario : scenarioById(scenarioId);
  const last = [...messages]
    .reverse()
    .find((message) => message.scenarioId === scenarioId && message.role === "assistant");

  return (
    <aside className="fixed bottom-3 left-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-xl border border-stone-400 bg-white text-xs shadow-lg">
      <button
        type="button"
        className="flex w-full items-center justify-between px-3 py-2 font-medium"
        onClick={() => setCollapsed((value) => !value)}
        aria-expanded={!collapsed}
      >
        Debug
        <span>{collapsed ? "Show" : "Hide"}</span>
      </button>
      {collapsed ? null : (
        <div className="max-h-[40vh] space-y-2 overflow-auto border-t border-stone-200 px-3 py-2">
          {!started ? (
            <p>Session not started.</p>
          ) : (
            <p>
              pid {pid} · phase {phase} · condition {conditions[index] ?? "—"} · delay {delayMs}ms
            </p>
          )}
          <p>
            URL condition {params.condition ?? "none"} · mode {params.mode} · delay{" "}
            {readDelay(ANNOTATION_DELAY_MS)}ms
          </p>
          <p>Node {last?.nodeId ?? "—"}</p>
          <p>
            Last route{" "}
            {lastRoute
              ? `${lastRoute.matched ? lastRoute.keyword : "fallback"} → ${lastRoute.goto}`
              : "—"}
          </p>
          {scenario ? (
            <ul className="space-y-1">
              {scenario.claims.map((claim) => (
                <li key={claim.id}>
                  {claim.id} · {computeQuadrant(claim)} · {claim.verdict}
                </li>
              ))}
            </ul>
          ) : null}
          <ul className="space-y-1">
            {[...events].slice(-8).reverse().map((event, eventIndex) => (
              <li key={`${event.ts}-${eventIndex}`}>
                {event.type}
                {event.claim_id ? ` ${event.claim_id}` : ""}
                {event.node_id ? ` ${event.node_id}` : ""}
              </li>
            ))}
          </ul>
          <button type="button" className="rounded-full border border-stone-400 px-2 py-1" onClick={reset}>
            Reset session
          </button>
        </div>
      )}
    </aside>
  );
}
