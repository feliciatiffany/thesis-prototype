import type { Condition, StudyMode } from "../types.ts";

const CONDITIONS: Condition[] = ["A", "B", "C", "D"];

/** Stable 32-bit string hash. Documented so assignment can be reproduced. */
export function hashPid(pid: string): number {
  let h = 0;
  for (let i = 0; i < pid.length; i++) {
    h = Math.imul(h, 31) + pid.charCodeAt(i);
    h >>>= 0;
  }
  return h;
}

export function conditionFromPid(pid: string): Condition {
  return CONDITIONS[hashPid(pid) % 4] ?? "A";
}

/** Cyclic 3×3 Latin square. Row is pid hash mod 3. */
export function latinSquareOrder(pid: string, taskIds: string[]): string[] {
  if (taskIds.length === 0) return [];
  const row = hashPid(pid) % taskIds.length;
  return [...taskIds.slice(row), ...taskIds.slice(0, row)];
}

export function pilotPlan(pid: string): {
  taskIds: string[];
  conditions: Condition[];
} {
  if (hashPid(pid) % 2 === 0) {
    return { taskIds: ["t1", "t2"], conditions: ["A", "D"] };
  }
  return { taskIds: ["t2", "t1"], conditions: ["D", "A"] };
}

export function completionCode(
  pid: string,
  condition: string,
  eventCount: number,
  feverCorrect: number,
): string {
  const n =
    hashPid(`${pid}|${condition}|${eventCount}|${feverCorrect}`) % 10000;
  return `TKD-${condition}-${String(n).padStart(4, "0")}`;
}

export function parseCondition(value: string | null): Condition | null {
  const upper = value?.trim().toUpperCase() ?? "";
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D") {
    return upper;
  }
  return null;
}

export function readStudyParams(): {
  pid: string;
  condition: Condition | null;
  mode: StudyMode;
  debug: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  return {
    pid: params.get("pid")?.trim() ?? "",
    condition: parseCondition(params.get("condition")),
    mode: params.get("mode") === "pilot" ? "pilot" : "standard",
    debug: params.get("debug") === "1",
  };
}

export function safeFilePart(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
  return cleaned || "session";
}
