import { scenarioById } from "./data.ts";
import { computeQuadrant } from "./quadrant.ts";
import type {
  BeliefValue,
  DecisionRecord,
  LogEvent,
  Node,
  Scenario,
  StudyData,
  Verdict,
} from "../types.ts";

export const SCENARIO_HEADERS = [
  "pid",
  "condition",
  "delay_ms",
  "scenario_id",
  "decision",
  "decision_correct",
  "reasons_selected",
  "reasons_include_planted_error",
  "human_fever_correct",
  "n_turns",
  "n_free_text",
  "n_fallback",
  "questions_about_planted_errors",
  "marks_opened",
  "time_to_decision_ms",
] as const;

export const BELIEF_HEADERS = [
  "pid",
  "condition",
  "scenario_id",
  "claim_id",
  "quadrant",
  "verdict",
  "is_planted_error",
  "belief",
  "confidence",
  "belief_correct",
  "mark_seen",
  "mark_opened",
  "asked_about",
  "branch_opened_before_decision",
] as const;

function eventsFor(events: LogEvent[], scenarioId: string): LogEvent[] {
  return events.filter((event) => event.scenario_id === scenarioId);
}

function plantedIds(scenario: Scenario): Set<string> {
  return new Set(
    scenario.claims.filter((claim) => claim.is_planted_error).map((claim) => claim.id),
  );
}

function aboutIds(node: Node | undefined): string[] {
  if (!node) return [];
  return [node.about_claim, ...(node.about_claims ?? [])].filter(
    (id): id is string => Boolean(id),
  );
}

function nodeTouchesPlanted(scenario: Scenario, nodeId: string | undefined): boolean {
  if (!nodeId) return false;
  const node = scenario.nodes.find((item) => item.id === nodeId);
  const planted = plantedIds(scenario);
  return aboutIds(node).some((id) => planted.has(id));
}

function gotoOf(event: LogEvent): string | undefined {
  const goto = event.payload.goto;
  return typeof goto === "string" ? goto : undefined;
}

export function beliefIsCorrect(verdict: Verdict, belief: BeliefValue): boolean {
  if (verdict === "SUPPORTED") return belief === "True";
  if (verdict === "REFUTED") return belief === "False";
  return belief === "Not sure" || belief === "False";
}

export function scoreDecision(
  data: StudyData,
  decision: DecisionRecord,
): Record<string, unknown> {
  const scenario = scenarioById(decision.scenarioId);
  const events = eventsFor(data.events, decision.scenarioId);
  const planted = scenario ? plantedIds(scenario) : new Set<string>();
  const rationale = new Set(scenario?.decision.rationale_claim_ids ?? []);
  const reasons = decision.reasonClaimIds;
  const decisionCorrect = scenario
    ? decision.optionId === scenario.decision.correct_option
    : false;
  const hasRationale = reasons.some((id) => rationale.has(id));
  const hasPlanted = reasons.some((id) => planted.has(id));
  const questions = events.filter((event) => {
    if (event.type !== "chip_tap" && event.type !== "intent_routed") return false;
    return scenario ? nodeTouchesPlanted(scenario, gotoOf(event)) : false;
  }).length;
  const selected = [...reasons];
  if (decision.otherReason.trim()) selected.push("something_else");
  const started = events.find((event) => event.type === "scenario_start");
  const submitted = events.find((event) => event.type === "decision_submit");
  const time =
    started && submitted ? Math.max(0, submitted.t) : decision.submittedAt;

  return {
    pid: data.pid,
    condition: decision.condition,
    delay_ms: data.delayMs,
    scenario_id: decision.scenarioId,
    decision: decision.optionId,
    decision_correct: decisionCorrect,
    reasons_selected: selected.join("|"),
    reasons_include_planted_error: hasPlanted,
    human_fever_correct: decisionCorrect && hasRationale && !hasPlanted,
    n_turns: decision.userTurns,
    n_free_text: events.filter((event) => event.type === "free_text").length,
    n_fallback: events.filter((event) => event.type === "fallback_hit").length,
    questions_about_planted_errors: questions,
    marks_opened: events.filter((event) => event.type === "mark_open").length,
    time_to_decision_ms: time,
  };
}

export function scoreBeliefs(
  data: StudyData,
  decision: DecisionRecord,
): Record<string, unknown>[] {
  const scenario = scenarioById(decision.scenarioId);
  if (!scenario) return [];
  const events = eventsFor(data.events, decision.scenarioId);
  return scenario.claims
    .filter((claim) => claim.key_claim)
    .map((claim) => {
      const answer = decision.beliefs.find((item) => item.claimId === claim.id);
      const belief = answer?.belief ?? "Not sure";
      const asked = events.some((event) => {
        if (event.type !== "chip_tap" && event.type !== "intent_routed") return false;
        const node = scenario.nodes.find((item) => item.id === gotoOf(event));
        return aboutIds(node).includes(claim.id);
      });
      const submitAt = events.findIndex((event) => event.type === "decision_submit");
      const beforeDecision = submitAt < 0 ? events : events.slice(0, submitAt);
      const branchOpened = beforeDecision.some(
        (event) => event.type === "branch_open" && event.claim_id === claim.id,
      );
      return {
        pid: data.pid,
        condition: decision.condition,
        scenario_id: decision.scenarioId,
        claim_id: claim.id,
        quadrant: computeQuadrant(claim),
        verdict: claim.verdict,
        is_planted_error: claim.is_planted_error,
        belief,
        confidence: answer?.confidence ?? "",
        belief_correct: answer ? beliefIsCorrect(claim.verdict, answer.belief) : false,
        mark_seen: events.some(
          (event) => event.type === "mark_visible" && event.claim_id === claim.id,
        ),
        mark_opened: events.some(
          (event) => event.type === "mark_open" && event.claim_id === claim.id,
        ),
        asked_about: asked,
        branch_opened_before_decision: branchOpened,
      };
    });
}

export function scenarioTable(data: StudyData): Record<string, unknown>[] {
  return data.decisions
    .filter((decision) => decision.scenarioId !== "tutorial")
    .map((decision) => scoreDecision(data, decision));
}

export function beliefTable(data: StudyData): Record<string, unknown>[] {
  return data.decisions
    .filter((decision) => decision.scenarioId !== "tutorial")
    .flatMap((decision) => scoreBeliefs(data, decision));
}
