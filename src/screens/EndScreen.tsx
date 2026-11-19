import { RestartButton } from "../components/RestartButton.tsx";
import { completionCode, safeFilePart } from "../lib/assignment.ts";
import { downloadText, toCsv } from "../lib/download.ts";
import { BELIEF_HEADERS, SCENARIO_HEADERS, beliefTable, scenarioTable } from "../lib/scoring.ts";
import { useStudy } from "../store/useStudy.ts";

export function EndScreen() {
  const pid = useStudy((state) => state.pid);
  const sessionCondition = useStudy((state) => state.sessionCondition);
  const mode = useStudy((state) => state.mode);
  const delayMs = useStudy((state) => state.delayMs);
  const scenarioOrder = useStudy((state) => state.scenarioOrder);
  const events = useStudy((state) => state.events);
  const questionnaires = useStudy((state) => state.questionnaires);
  const data = useStudy.getState();
  const scenarios = scenarioTable(data);
  const beliefs = beliefTable(data);
  const fever = scenarios.filter((row) => row.human_fever_correct === true).length;
  const code = completionCode(pid, sessionCondition, events.length, fever);
  const stem = `${safeFilePart(pid)}_${safeFilePart(sessionCondition)}`;
  const payload = {
    pid,
    condition: sessionCondition,
    mode,
    delay_ms: delayMs,
    scenario_order: scenarioOrder,
    events,
    scenarios,
    beliefs,
    questionnaires,
  };

  return (
    <main className="screen">
      <div className="screen-card">
      <h1 className="text-2xl font-medium">Session complete</h1>
      <p className="mt-3 leading-relaxed">
        Your completion code is <strong className="font-medium">{code}</strong>. Download the three
        files and send them to the researcher.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          className="primary"
          onClick={() =>
            downloadText(
              `${stem}_events.json`,
              JSON.stringify(payload, null, 2),
              "application/json",
            )
          }
        >
          Download events.json
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            downloadText(`${stem}_scenarios.csv`, toCsv(scenarios, [...SCENARIO_HEADERS]), "text/csv")
          }
        >
          Download scenarios.csv
        </button>
        <button
          type="button"
          className="ghost"
          onClick={() =>
            downloadText(`${stem}_beliefs.csv`, toCsv(beliefs, [...BELIEF_HEADERS]), "text/csv")
          }
        >
          Download beliefs.csv
        </button>
        <RestartButton />
      </div>
      </div>
    </main>
  );
}
