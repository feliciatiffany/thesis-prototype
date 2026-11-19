import type { Condition, StudyMode } from "../types.ts";

const CONDITIONS: Condition[] = ["A", "B", "C", "D"];

/** Stable 32-bit string hash. The same id always gets the same condition and order. */
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

/** Cyclic order. Row is pid hash mod the number of scenarios. */
export function latinSquareOrder(pid: string, scenarioIds: string[]): string[] {
  if (scenarioIds.length === 0) return [];
  const row = hashPid(pid) % scenarioIds.length;
  return [...scenarioIds.slice(row), ...scenarioIds.slice(0, row)];
}

/** Within-subjects pilot: scenario 1 in A, scenario 2 in D, order flipped by pid. */
export function pilotPlan(pid: string): {
  scenarioIds: string[];
  conditions: Condition[];
} {
  if (hashPid(pid) % 2 === 0) {
    return { scenarioIds: ["s1", "s2"], conditions: ["A", "D"] };
  }
  return { scenarioIds: ["s2", "s1"], conditions: ["D", "A"] };
}

export function completionCode(
  pid: string,
  condition: string,
  eventCount: number,
  feverCorrect: number,
): string {
  const n = hashPid(`${pid}|${condition}|${eventCount}|${feverCorrect}`) % 10000;
  return `TKD-${condition}-${String(n).padStart(4, "0")}`;
}

export function parseCondition(value: string | null): Condition | null {
  const upper = value?.trim().toUpperCase() ?? "";
  if (upper === "A" || upper === "B" || upper === "C" || upper === "D") return upper;
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

/** Only 0, 1200, and 3000 are study values. Anything else stays at the default. */
export function readDelay(fallback: number): number {
  const raw = new URLSearchParams(window.location.search).get("delay");
  if (raw === "0" || raw === "1200" || raw === "3000") return Number(raw);
  return fallback;
}

export function safeFilePart(value: string): string {
  const cleaned = value.trim().replace(/[^a-zA-Z0-9_-]+/g, "_");
  return cleaned || "session";
}
