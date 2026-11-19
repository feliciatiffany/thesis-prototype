import type { Claim, ClaimBranch, Condition, Passage, Quadrant } from "../types.ts";
import { quadrantOf } from "./marks.ts";

export interface BarParts {
  agree: number;
  disagree: number;
  absent: number;
  total: number;
}

export function answerBranch(claim: Claim): ClaimBranch | undefined {
  return claim.branches.find((branch) => branch.value === claim.key_span);
}

export function barParts(claim: Claim): BarParts {
  const total = claim.consistency.total;
  const answer = answerBranch(claim);
  const agree = answer?.count ?? claim.consistency.agree;
  const disagree = claim.branches
    .filter((branch) => branch.value !== claim.key_span)
    .reduce((sum, branch) => sum + branch.count, 0);
  return {
    agree,
    disagree,
    absent: Math.max(0, total - agree - disagree),
    total,
  };
}

export function derivedAlternatives(claim: Claim): string[] {
  return claim.branches
    .filter((branch) => branch.value !== claim.key_span)
    .map((branch) => branch.value);
}

/** Warn when the bar, the branch counts, and the older alternatives drift apart. */
export function warnClaimSignals(claims: Claim[], label: string): string[] {
  const problems: string[] = [];
  for (const claim of claims) {
    if (!claim.text.includes(claim.key_span)) {
      problems.push(`${label} ${claim.id}: key_span is not in the claim text.`);
    }
    const answer = answerBranch(claim);
    if (!answer) {
      problems.push(`${label} ${claim.id}: no branch matches key_span.`);
    } else if (answer.count !== claim.consistency.agree) {
      problems.push(
        `${label} ${claim.id}: agree is ${claim.consistency.agree}, branch count is ${answer.count}.`,
      );
    }
    const derived = [...derivedAlternatives(claim)].sort();
    const listed = [...claim.consistency.alternatives].sort();
    if (derived.join("|") !== listed.join("|")) {
      problems.push(
        `${label} ${claim.id}: alternatives [${listed.join(", ")}] do not match branches [${derived.join(", ")}].`,
      );
    }
  }
  for (const problem of problems) console.warn(problem);
  return problems;
}

/** Every condition shows the blue and orange bar on each key word. */
export function showsMicroBar(): boolean {
  return true;
}

export function showsSourceGlyph(condition: Condition, claim: Claim, showAll: boolean): boolean {
  if (condition === "C") return true;
  if (condition !== "D") return false;
  if (showAll) return true;
  return quadrantOf(claim) !== "solid";
}

export function visibleBranches(claim: Claim, expanded: boolean): {
  rows: ClaimBranch[];
  hidden: number;
} {
  const rows = [...claim.branches].sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
  if (expanded || rows.length <= 3) return { rows, hidden: 0 };
  return { rows: rows.slice(0, 3), hidden: rows.length - 3 };
}

const QUADRANT_ORDER: Quadrant[] = [
  "confidently_wrong",
  "speculation",
  "unstable_sourced",
  "solid",
];

export function sortClaims(claims: Claim[]): Claim[] {
  return [...claims].sort(
    (a, b) => QUADRANT_ORDER.indexOf(quadrantOf(a)) - QUADRANT_ORDER.indexOf(quadrantOf(b)),
  );
}

export function quadrantLabel(claim: Claim): string {
  const quadrant = quadrantOf(claim);
  if (quadrant === "solid") return "Agreed, source supports it";
  if (quadrant === "unstable_sourced") return "Wording varied, source has an answer";
  if (quadrant === "confidently_wrong" && claim.verdict === "NEI") {
    return "Repeated, no source confirms it";
  }
  if (quadrant === "confidently_wrong") return "Repeated, sources disagree";
  if (claim.verdict === "NEI") return "Wording varied, no source confirms it";
  return "Wording varied, sources disagree";
}

export function passageForValue(
  claim: Claim,
  passages: Passage[],
  value: string,
): Passage | undefined {
  const linked = claim.evidence_ids
    .map((id) => passages.find((passage) => passage.id === id))
    .filter((passage): passage is Passage => Boolean(passage));
  const needle = value.toLowerCase();
  return (
    linked.find((passage) => passage.text.toLowerCase().includes(needle)) ?? linked[0]
  );
}

export function splitKey(
  text: string,
  key: string,
): { before: string; key: string; after: string } | null {
  if (!key) return null;
  const index = text.indexOf(key);
  if (index < 0) return null;
  return { before: text.slice(0, index), key, after: text.slice(index + key.length) };
}
