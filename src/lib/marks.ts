import { computeQuadrant } from "./quadrant.ts";
import type { Claim, Condition, Passage, Quadrant, Verdict } from "../types.ts";

export type MarkStyle = "none" | "dots" | "line" | "amber" | "note";

export function quadrantOf(claim: Claim): Quadrant {
  return computeQuadrant(claim);
}

export function showsDoubtMark(condition: Condition, claim: Claim): boolean {
  if (condition === "A") return false;
  if (condition === "B") return claim.consistency.agree < claim.consistency.total;
  if (condition === "C") return claim.verdict !== "SUPPORTED";
  return quadrantOf(claim) !== "solid";
}

export function markStyle(condition: Condition, claim: Claim): MarkStyle {
  if (!showsDoubtMark(condition, claim)) return "none";
  if (condition === "B") return "dots";
  if (condition === "C") return "line";
  const quadrant = quadrantOf(claim);
  if (quadrant === "unstable_sourced") return "dots";
  if (quadrant === "speculation") return "amber";
  if (quadrant === "confidently_wrong") return "note";
  return "none";
}

/** Solid claims in D can still be opened for the source, with no visual mark. */
export function claimIsTappable(condition: Condition, claim: Claim): boolean {
  if (condition === "A") return false;
  if (condition === "D" && quadrantOf(claim) === "solid") return true;
  return showsDoubtMark(condition, claim);
}

export function verdictWords(verdict: Verdict): string {
  if (verdict === "SUPPORTED") return "Supported";
  if (verdict === "REFUTED") return "Sources disagree";
  return "No source covers this";
}

export function confidentlyWrongNote(claim: Claim): string {
  if (claim.verdict === "NEI") {
    return "The AI repeats this, but no source confirms it";
  }
  return "The AI repeats this, but sources disagree";
}

function answerList(claim: Claim): string {
  const parts = [...claim.consistency.alternatives];
  if (claim.source_says && !parts.includes(claim.source_says)) {
    parts.push(claim.source_says);
  }
  return parts.join(" / ");
}

/** The sentence a screen reader hears with the claim. Refuted and NEI stay distinct. */
export function doubtSentence(condition: Condition, claim: Claim): string {
  const { agree, total } = claim.consistency;
  if (condition === "B") {
    const alts = claim.consistency.alternatives;
    const extra =
      alts.length > 0 ? ` Other answers said: ${alts.join(", ")}.` : "";
    return `${agree} of ${total} answers said this.${extra}`;
  }
  if (condition === "C") return verdictWords(claim.verdict);
  const quadrant = quadrantOf(claim);
  if (quadrant === "solid") return "Source available.";
  if (quadrant === "unstable_sourced") {
    return `The AI gave different answers: ${answerList(claim)}. The source says ${claim.source_says ?? "this"}.`;
  }
  if (quadrant === "confidently_wrong") return confidentlyWrongNote(claim);
  const alts = claim.consistency.alternatives;
  const varied =
    alts.length > 0 ? ` The AI also said: ${alts.join(", ")}.` : "";
  return `${verdictWords(claim.verdict)}.${varied}`;
}

export function passagesFor(
  claim: Claim,
  passages: Passage[],
): Passage[] {
  return claim.evidence_ids
    .map((id) => passages.find((passage) => passage.id === id))
    .filter((passage): passage is Passage => Boolean(passage));
}
