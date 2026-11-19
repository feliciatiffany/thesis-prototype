import { tutorialScenario } from "../data/tutorial.ts";
import { scenarios } from "./data.ts";
import { computeQuadrant } from "./quadrant.ts";
import { barParts, warnClaimSignals } from "./signals.ts";
import type { Quadrant } from "../types.ts";

const S1_EXPECTED: Record<string, Quadrant> = {
  s1c1: "solid",
  s1c2: "confidently_wrong",
  s1c3: "solid",
  s1c4: "unstable_sourced",
  s1c5: "confidently_wrong",
  s1c6: "speculation",
  s1c7: "solid",
  s1c8: "speculation",
};

export function validateStudyContent(): string[] {
  const problems: string[] = [];
  const scenario = scenarios.find((item) => item.id === "s1");
  if (!scenario) {
    problems.push("Scenario s1 is missing.");
    return problems;
  }
  for (const [id, quadrant] of Object.entries(S1_EXPECTED)) {
    const claim = scenario.claims.find((item) => item.id === id);
    if (!claim) {
      problems.push(`Missing claim ${id}.`);
      continue;
    }
    const got = computeQuadrant(claim);
    if (got !== quadrant) {
      problems.push(`${id} computed as ${got}, expected ${quadrant}.`);
    }
  }
  const start = scenario.nodes.find((node) => node.id === scenario.start_node);
  if (!start) problems.push("Scenario s1 has no start node.");
  const fallback = scenario.nodes.find((node) => node.id === scenario.fallback_node);
  if (!fallback) problems.push("Scenario s1 has no fallback node.");
  for (const item of scenarios) {
    problems.push(...warnClaimSignals(item.claims, item.id));
  }
  problems.push(...warnClaimSignals(tutorialScenario.claims, "tutorial"));
  const range = scenario.claims.find((item) => item.id === "s1c2");
  if (range) {
    const parts = barParts(range);
    if (parts.agree !== 8 || parts.disagree !== 2 || parts.absent !== 0) {
      problems.push(
        `s1c2 bar is ${parts.agree}/${parts.disagree}/${parts.absent}, expected 8/2/0.`,
      );
    }
  }
  return problems;
}
