import { HIGH_CONSISTENCY_THRESHOLD } from "../config.ts";
import type { Claim, Quadrant } from "../types.ts";

export function isHighConsistency(agree: number, total: number): boolean {
  if (total <= 0) return false;
  return agree / total >= HIGH_CONSISTENCY_THRESHOLD;
}

export function computeQuadrant(
  claim: Pick<Claim, "consistency" | "verdict">,
): Quadrant {
  const high = isHighConsistency(claim.consistency.agree, claim.consistency.total);
  const supported = claim.verdict === "SUPPORTED";
  if (high && supported) return "solid";
  if (high && !supported) return "confidently_wrong";
  if (!high && supported) return "unstable_sourced";
  return "speculation";
}
