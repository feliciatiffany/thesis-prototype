import raw from "../data/scenarios.json";
import type { Chip, Condition, Node, Scenario, ScenarioFile } from "../types.ts";

const file = raw as ScenarioFile;

export const studyNote = file._note;
export const scenarios: Scenario[] = file.scenarios;

export function scenarioById(id: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.id === id);
}

export function visibleChips(node: Node, condition: Condition): Chip[] {
  return node.chips.filter((chip) => !chip.condition || chip.condition === condition);
}

export function allPassages(scenario: Scenario) {
  return [...scenario.passages, ...scenario.extra_passages];
}

/** A chip whose destination is about this claim, so Ask about this can prefill it. */
export function askLabel(scenario: Scenario, claimId: string, condition: Condition): string {
  const nodesAbout = scenario.nodes.filter((node) => {
    if (node.about_claim === claimId) return true;
    if (node.about_claims?.includes(claimId)) return true;
    return node.segments.some(
      (segment) => segment.kind === "claim" && segment.claim_id === claimId,
    );
  });
  const preferred = [
    ...nodesAbout.filter((node) => node.about_claim === claimId),
    ...nodesAbout,
  ];
  for (const node of preferred) {
    for (const source of scenario.nodes) {
      const chip = source.chips.find(
        (item) =>
          item.goto === node.id && (!item.condition || item.condition === condition),
      );
      if (chip) return chip.label;
    }
  }
  const claim = scenario.claims.find((item) => item.id === claimId);
  return claim?.text ?? "Can you say more about that?";
}
