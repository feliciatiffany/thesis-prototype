import { STORAGE_KEY } from "../config.ts";
import type { SessionState } from "../types.ts";

export function loadSession(): SessionState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SessionState;
    if (parsed.version !== 1 || !parsed.started || !parsed.pid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSession(state: SessionState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Private mode or a full disk should not crash the session.
  }
}

export function clearSession() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
