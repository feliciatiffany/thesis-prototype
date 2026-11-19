import { useMemo, useState } from "react";
import { Frame } from "../components/Frame.tsx";
import { useStudy } from "../context/StudyContext.tsx";
import { completionCode, safeFilePart } from "../lib/assignment.ts";
import { tasks } from "../lib/data.ts";
import { downloadText, toCsv } from "../lib/download.ts";
import { buildClaimRows } from "../lib/scoring.ts";

const CLAIM_HEADERS = [
  "pid",
  "condition",
  "task_id",
  "claim_id",
  "quadrant",
  "verdict",
  "is_planted_error",
  "final_action",
  "final_text",
  "evidence_selected",
  "evidence_correct",
  "action_correct",
  "human_fever_correct",
  "confidence",
  "time_on_claim_ms",
  "details_opened",
  "evidence_skipped",
];

const QUESTION_HEADERS = [
  "pid",
  "condition",
  "task_id",
  "mental",
  "physical",
  "temporal",
  "performance",
  "effort",
  "frustration",
  "trust_ai",
  "trust_interface",
  "control",
];

export function EndScreen() {
  const study = useStudy();
  const [copied, setCopied] = useState(false);
  const rows = useMemo(
    () => buildClaimRows(study.state, tasks, Date.now()),
    [study.state],
  );
  const correct = rows.filter((row) => row.human_fever_correct).length;
  const code = completionCode(
    study.state.pid,
    study.state.sessionCondition,
    study.state.events.length,
    correct,
  );
  const prefix = `${safeFilePart(study.state.pid)}_${study.state.sessionCondition}`;

  function downloadAll() {
    const payload = {
      _note: "Session export for Two Kinds of Doubt. Claim rows include human_fever_correct.",
      pid: study.state.pid,
      condition: study.state.sessionCondition,
      mode: study.state.mode,
      completion_code: code,
      exported_at: new Date().toISOString(),
      events: study.state.events,
      claims: rows,
      questionnaires: study.state.questionnaires,
    };
    const questions = study.state.questionnaires.map((item) => ({
      pid: study.state.pid,
      ...item,
    }));
    downloadText(
      `${prefix}_events.json`,
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    window.setTimeout(() => {
      downloadText(
        `${prefix}_claims.csv`,
        toCsv(rows as unknown as Record<string, unknown>[], CLAIM_HEADERS),
        "text/csv",
      );
    }, 400);
    window.setTimeout(() => {
      downloadText(
        `${prefix}_questionnaire.csv`,
        toCsv(questions, QUESTION_HEADERS),
        "text/csv",
      );
    }, 800);
  }

  return (
    <Frame title="Session complete">
      <p>Thank you. Give this completion code to the researcher.</p>
      <p className="rounded-md border border-stone-300 bg-white px-4 py-6 text-center font-mono text-3xl tracking-widest text-stone-950">
        {code}
      </p>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard?.writeText(code).then(() => setCopied(true));
        }}
        className="rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-medium text-stone-900"
      >
        {copied ? "Copied" : "Copy code"}
      </button>
      <p>
        Download your data before you close the window. The files stay on this computer. They are
        not uploaded.
      </p>
      <button
        type="button"
        onClick={downloadAll}
        className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
      >
        Download my data
      </button>
      <p className="text-sm text-stone-600">
        This saves {prefix}_events.json, {prefix}_claims.csv, and {prefix}_questionnaire.csv. If
        the browser only saves one file, click the button again.
      </p>
      <button
        type="button"
        onClick={study.reset}
        className="text-sm text-stone-700 underline"
      >
        Start a new session in this browser
      </button>
    </Frame>
  );
}
