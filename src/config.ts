import type { Quadrant } from "./types.ts";

/** High consistency means at least this share of sampled answers agreed. 0.7 is 7 of 10. */
export const HIGH_CONSISTENCY_THRESHOLD = 0.7;

/** Marks fade in this long after a message finishes streaming. */
export const ANNOTATION_DELAY_MS = 1200;

export const THINKING_MS = 600;
export const STREAM_CHARS = 40;
export const STREAM_TICK_MS = 50;

export const MIN_USER_TURNS = 2;
export const STORAGE_KEY = "twokinds.chat.v1";

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  solid: "Consistent and sourced",
  confidently_wrong: "Repeated, not backed by the sources",
  speculation: "Unsure, and the sources don't confirm it",
  unstable_sourced: "The wording varied, and a source has it",
};

export const NASA_TLX = [
  {
    id: "mental",
    label: "How demanding was the conversation?",
    low: "Low",
    high: "High",
  },
  {
    id: "effort",
    label: "How hard did you have to work?",
    low: "Low",
    high: "High",
  },
  {
    id: "performance",
    label: "How well did you make the decision?",
    low: "Good",
    high: "Poor",
  },
  {
    id: "frustration",
    label: "How frustrated were you?",
    low: "Low",
    high: "High",
  },
] as const;

export const TRUST_ITEMS = [
  { id: "trust_ai", label: "I trust the assistant's answers" },
  { id: "trust_markers", label: "I trust the marks in the replies", conditions: ["B", "C", "D"] as const },
  { id: "would_use", label: "I'd use this for a real choice like this" },
] as const;
