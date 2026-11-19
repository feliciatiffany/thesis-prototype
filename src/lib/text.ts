import type { Claim, Node, Scenario, Segment } from "../types.ts";

export function claimById(scenario: Scenario, id: string): Claim | undefined {
  return scenario.claims.find((claim) => claim.id === id);
}

export function nodeById(scenario: Scenario, id: string): Node | undefined {
  return scenario.nodes.find((node) => node.id === id);
}

export function segmentText(segment: Segment, scenario: Scenario): string {
  if (segment.kind === "text") return segment.text;
  if (segment.text) return segment.text;
  return claimById(scenario, segment.claim_id)?.text ?? "";
}

export function nodePlainText(scenario: Scenario, node: Node): string {
  return node.segments.map((segment) => segmentText(segment, scenario)).join("");
}

export function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
