import { STORAGE_KEY } from "../config.ts";
import type { StudyData } from "../types.ts";

export function loadStudy(): StudyData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StudyData;
    if (parsed.version !== 1 || !parsed.started || !parsed.pid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveStudy(state: StudyData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full disk should not crash the session.
  }
}

export function clearStudy() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
