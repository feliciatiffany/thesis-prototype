import { deriveClaim } from "./quadrant.ts";
import type {
  Claim,
  ClaimRuntime,
  ClaimSummaryRow,
  SessionState,
  Task,
} from "../types.ts";

export function scoreClaim(claim: Claim, runtime: ClaimRuntime) {
  const action = runtime.action;
  const action_correct =
    action != null && claim.correct_actions.includes(action);
  const evidence_skipped = runtime.evidenceId == null;

  let evidence_correct = false;
  if (claim.verdict === "SUPPORTED" && action === "keep" && evidence_skipped) {
    evidence_correct = true;
  } else if (runtime.evidenceId === "none") {
    evidence_correct = claim.verdict === "NEI";
  } else if (runtime.evidenceId) {
    evidence_correct = claim.evidence_ids.includes(runtime.evidenceId);
  }

  return {
    action_correct,
    evidence_correct,
    evidence_skipped,
    human_fever_correct: action_correct && evidence_correct,
  };
}

export function timeOnClaim(runtime: ClaimRuntime, now: number): number {
  const extra = runtime.openStartedAt
    ? Math.max(0, now - runtime.openStartedAt)
    : 0;
  return runtime.timeOnClaimMs + extra;
}

export function buildClaimRows(
  state: SessionState,
  tasks: Task[],
  now: number,
): ClaimSummaryRow[] {
  const rows: ClaimSummaryRow[] = [];
  state.taskOrder.forEach((taskId, index) => {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) return;
    const condition = state.taskConditions[index] ?? state.sessionCondition;
    for (const claim of task.claims) {
      const runtime = state.claimStates[claim.id];
      if (!runtime) continue;
      const derived = deriveClaim(claim);
      const score = scoreClaim(claim, runtime);
      rows.push({
        pid: state.pid,
        condition,
        task_id: task.id,
        claim_id: claim.id,
        quadrant: derived.quadrant,
        verdict: claim.verdict,
        is_planted_error: claim.is_planted_error,
        final_action: runtime.action ?? "",
        final_text: runtime.finalText,
        evidence_selected: runtime.evidenceId ?? "",
        evidence_correct: score.evidence_correct,
        action_correct: score.action_correct,
        human_fever_correct: score.human_fever_correct,
        confidence: runtime.confidence ?? "",
        time_on_claim_ms: timeOnClaim(runtime, now),
        details_opened: runtime.detailsOpened,
        evidence_skipped: score.evidence_skipped,
      });
    }
  });
  return rows;
}
