/**
 * The starting example for the paper trail prototype, taken from the
 * "prototype- builds" wireframe in FigJam. The quotes and page numbers are as
 * written in the wireframe: check them against the papers before a session.
 */

import type { Verdict } from "../../server/trail.ts";

export type { Verdict };

/** The result of checking one sentence of the notes. */
export type Check = {
  verdict: Verdict;
  phrase: string;
  cite: string;
  quote: string;
  quoteFound: boolean;
};

/** Chat study source colours: check, cross, empty circle. */
export const VERDICT: Record<Verdict, { label: string; color: string }> = {
  supported: { label: "Supported", color: "var(--src-support)" },
  contested: { label: "Contested", color: "var(--src-refute)" },
  not_covered: { label: "No paper covers this", color: "var(--src-none)" },
};

export const EXAMPLE_NOTES =
  "Students who take notes by hand remember concepts better than laptop users. A 2014 study found laptop users transcribe verbatim, which reduces processing. Later work questions whether the effect holds. Replications show no significant difference in recall when laptop distraction is controlled.";

export const EXAMPLE_PAPERS = [
  { id: "mueller", title: "Mueller & Oppenheimer, 2014", sections: [], example: true },
  { id: "morehead", title: "Morehead et al., 2019", sections: [], example: true },
];

const MUELLER = {
  cite: "Mueller & Oppenheimer · 2014 · p.3",
  quote: "Laptop note-takers performed worse on conceptual questions.",
  quoteFound: true,
};

/** Keyed by sentence, as the recheck stores them. */
export const EXAMPLE_CHECKS: Record<string, Check> = {
  "Students who take notes by hand remember concepts better than laptop users.": {
    verdict: "supported",
    phrase: "remember concepts better",
    ...MUELLER,
  },
  "A 2014 study found laptop users transcribe verbatim, which reduces processing.": {
    verdict: "supported",
    phrase: "laptop users transcribe verbatim",
    ...MUELLER,
  },
  "Later work questions whether the effect holds.": {
    verdict: "not_covered",
    phrase: "Later work questions whether the effect holds.",
    cite: "",
    quote: "",
    quoteFound: false,
  },
  "Replications show no significant difference in recall when laptop distraction is controlled.": {
    verdict: "supported",
    phrase: "no significant difference in recall",
    cite: "Morehead et al. · 2019 · p.9",
    quote: "We did not replicate the longhand advantage.",
    quoteFound: true,
  },
};

/** Split notes into paragraphs of sentences, keeping each sentence's exact text. */
export function sentencesOf(notes: string): string[][] {
  const seg = new Intl.Segmenter("en", { granularity: "sentence" });
  return notes
    .split(/\n+/)
    .filter((p) => p.trim())
    .map((p) => [...seg.segment(p)].map((s) => s.segment.trim()).filter(Boolean));
}
