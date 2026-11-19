import type { Condition, Quadrant, Verdict } from "../types.ts";

export function verdictLabel(verdict: Verdict): string {
  if (verdict === "SUPPORTED") return "Supported";
  if (verdict === "REFUTED") return "Refuted";
  return "Not enough info";
}

export function verdictDetail(verdict: Verdict): string {
  if (verdict === "SUPPORTED") return "Sources support this";
  if (verdict === "REFUTED") return "Sources contradict this";
  return "No source covers this";
}

export function frictionKind(
  quadrant: Quadrant,
): "blocking" | "prompting" | "assisting" | "none" {
  if (quadrant === "confidently_wrong") return "blocking";
  if (quadrant === "speculation") return "prompting";
  if (quadrant === "unstable_sourced") return "assisting";
  return "none";
}

export function evidenceIsRequired(
  condition: Condition,
  quadrant: Quadrant,
): boolean {
  return condition === "D" && quadrant === "confidently_wrong";
}

export function suggestedActionIds(
  condition: Condition,
  quadrant: Quadrant,
  verdict: Verdict,
): string[] {
  if (condition !== "D" || quadrant !== "speculation") return [];
  if (verdict === "REFUTED") return ["delete", "rewrite", "use_source"];
  if (verdict === "NEI") return ["hedge", "search"];
  return [];
}

export function actionLabel(action: string): string {
  switch (action) {
    case "keep":
      return "Kept";
    case "delete":
      return "Deleted";
    case "hedge":
      return "Hedged";
    case "rewrite":
      return "Rewritten";
    case "use_source":
      return "Source wording";
    case "search":
      return "Searched";
    case "flag":
      return "Flagged";
    default:
      return action;
  }
}

export function suggestionCopy(verdict: Verdict): string {
  if (verdict === "REFUTED") {
    return "Sources contradict this. Suggested actions: delete or correct the claim.";
  }
  if (verdict === "NEI") {
    return "No source covers this. Suggested actions: hedge the claim, or search further.";
  }
  return "Sources support this.";
}
