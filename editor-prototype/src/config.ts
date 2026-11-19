import type { Quadrant } from "./types.ts";

/**
 * A claim is "high consistency" when at least this share of the sampled
 * responses agree. 0.7 means 7 of 10. Quadrants are computed in code from
 * this threshold plus the FEVER verdict. Do not store the quadrant in JSON.
 */
export const HIGH_CONSISTENCY_THRESHOLD = 0.7;

export const HEDGE_PREFIX = "Some sources suggest… ";

export const STORAGE_KEY = "twokinds.session.v1";

export const TUTORIAL_MS = 60_000;

export const QUADRANT_LABEL: Record<Quadrant, string> = {
  solid: "Consistent and sourced",
  confidently_wrong: "Repeated by the AI, not backed by sources",
  speculation: "The AI isn't sure and sources don't confirm",
  unstable_sourced: "The AI wavers, but a source has it",
};

export const QUADRANT_SHORT: Record<Quadrant, string> = {
  solid: "Consistent and sourced",
  confidently_wrong: "Not backed by sources",
  speculation: "Not confirmed",
  unstable_sourced: "Source has it",
};

export const NASA_TLX = [
  {
    id: "mental",
    label: "Mental demand",
    question: "How mentally demanding was the task?",
    low: "Low",
    high: "High",
  },
  {
    id: "physical",
    label: "Physical demand",
    question: "How physically demanding was the task?",
    low: "Low",
    high: "High",
  },
  {
    id: "temporal",
    label: "Temporal demand",
    question: "How hurried or rushed was the pace of the task?",
    low: "Low",
    high: "High",
  },
  {
    id: "performance",
    label: "Performance",
    question: "How successful were you in accomplishing what you were asked to do?",
    low: "Good",
    high: "Poor",
  },
  {
    id: "effort",
    label: "Effort",
    question: "How hard did you have to work to accomplish your level of performance?",
    low: "Low",
    high: "High",
  },
  {
    id: "frustration",
    label: "Frustration",
    question: "How insecure, discouraged, irritated, stressed, or annoyed were you?",
    low: "Low",
    high: "High",
  },
] as const;

export const TRUST_ITEMS = [
  { id: "trust_ai", label: "I trust the AI's answer" },
  { id: "trust_interface", label: "I trust this interface's signals" },
  { id: "control", label: "I felt in control of the final text" },
] as const;
