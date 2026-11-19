import { computeQuadrant } from "./quadrant.ts";
import type { Quadrant, Task, TaskFile, Verdict } from "../types.ts";

const VERDICTS: Verdict[] = ["SUPPORTED", "REFUTED", "NEI"];

const TASK1_QUADRANTS: Record<string, Quadrant> = {
  t1c1: "solid",
  t1c2: "confidently_wrong",
  t1c3: "solid",
  t1c4: "unstable_sourced",
  t1c5: "confidently_wrong",
  t1c6: "solid",
  t1c7: "speculation",
  t1c8: "solid",
  t1c9: "speculation",
};

function mix(task: Task) {
  const counts: Record<Quadrant, number> = {
    solid: 0,
    confidently_wrong: 0,
    speculation: 0,
    unstable_sourced: 0,
  };
  let refutedHigh = 0;
  let neiHigh = 0;
  let refutedLow = 0;
  let neiLow = 0;
  for (const claim of task.claims) {
    const quadrant = computeQuadrant(claim);
    counts[quadrant] += 1;
    if (quadrant === "confidently_wrong" && claim.verdict === "REFUTED") refutedHigh += 1;
    if (quadrant === "confidently_wrong" && claim.verdict === "NEI") neiHigh += 1;
    if (quadrant === "speculation" && claim.verdict === "REFUTED") refutedLow += 1;
    if (quadrant === "speculation" && claim.verdict === "NEI") neiLow += 1;
  }
  return { counts, refutedHigh, neiHigh, refutedLow, neiLow };
}

export function validateTasks(file: TaskFile): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!file || !Array.isArray(file.tasks)) {
    return { errors: ["tasks.json needs a tasks array."], warnings };
  }

  const taskIds = new Set<string>();
  const claimIds = new Set<string>();

  for (const task of file.tasks) {
    if (!task.id) {
      errors.push("A task is missing an id.");
      continue;
    }
    if (taskIds.has(task.id)) errors.push(`Duplicate task id ${task.id}.`);
    taskIds.add(task.id);
    if (!task.question) errors.push(`${task.id} is missing a question.`);
    if (!Array.isArray(task.claims) || task.claims.length === 0) {
      errors.push(`${task.id} needs at least one claim.`);
    }
    if (!Array.isArray(task.passages)) errors.push(`${task.id} needs a passages array.`);
    if (!Array.isArray(task.extra_passages)) {
      errors.push(`${task.id} needs an extra_passages array.`);
    }
    if (!Array.isArray(task.omitted_source_claims)) {
      errors.push(`${task.id} needs omitted_source_claims.`);
    }

    const passageIds = new Set((task.passages ?? []).map((passage) => passage.id));
    for (const claim of task.claims ?? []) {
      if (!claim.id) {
        errors.push(`${task.id} has a claim without an id.`);
        continue;
      }
      if (claimIds.has(claim.id)) errors.push(`Duplicate claim id ${claim.id}.`);
      claimIds.add(claim.id);
      if (!claim.text) errors.push(`${claim.id} is missing text.`);
      if (!VERDICTS.includes(claim.verdict)) {
        errors.push(`${claim.id} has an invalid verdict.`);
      }
      if (!claim.consistency || claim.consistency.total <= 0) {
        errors.push(`${claim.id} needs a consistency total above 0.`);
      } else if (claim.consistency.agree > claim.consistency.total) {
        errors.push(`${claim.id} has more agreeing samples than the total.`);
      }
      if (!Array.isArray(claim.correct_actions) || claim.correct_actions.length === 0) {
        errors.push(`${claim.id} needs correct_actions.`);
      }
      for (const evidenceId of claim.evidence_ids ?? []) {
        if (!passageIds.has(evidenceId)) {
          errors.push(`${claim.id} cites missing passage ${evidenceId}.`);
        }
      }
      if (claim.verdict === "NEI" && (claim.evidence_ids?.length ?? 0) > 0) {
        warnings.push(`${claim.id} is NEI but lists evidence passages.`);
      }
      if (claim.verdict !== "NEI" && (claim.evidence_ids?.length ?? 0) === 0) {
        warnings.push(`${claim.id} is ${claim.verdict} but has no evidence passage.`);
      }
    }

    const summary = mix(task);
    if (
      summary.counts.solid !== 4 ||
      summary.counts.confidently_wrong !== 2 ||
      summary.counts.unstable_sourced !== 1 ||
      summary.counts.speculation !== 2 ||
      summary.refutedHigh !== 1 ||
      summary.neiHigh !== 1 ||
      summary.refutedLow !== 1 ||
      summary.neiLow !== 1
    ) {
      warnings.push(
        `${task.id} no longer has the planned mix (4 solid, 2 confidently wrong split REFUTED/NEI, 1 unstable sourced, 2 speculation split REFUTED/NEI).`,
      );
    }
  }

  const task1 = file.tasks.find((task) => task.id === "t1");
  if (task1) {
    for (const [id, quadrant] of Object.entries(TASK1_QUADRANTS)) {
      const claim = task1.claims.find((item) => item.id === id);
      if (!claim) {
        errors.push(`Task 1 is missing ${id}.`);
        continue;
      }
      const actual = computeQuadrant(claim);
      if (actual !== quadrant) {
        errors.push(`${id} computed as ${actual}, expected ${quadrant}.`);
      }
    }
  }

  return { errors, warnings };
}
