import type { AnalyzedRelation } from "../../server/analyze.ts";
import type { Recommendation } from "../../server/trail.ts";

export type MapSource = {
  id: string;
  kind: "paper" | "link";
  /** Full title, or the link address until it is analyzed. */
  title: string;
  url?: string;
  /** Text read from a PDF, or from a link once analyzed. */
  text?: string;
  /** Short node label, such as "Mueller 2014". */
  label?: string;
  summary?: string;
  /** Part of the starting example: written by hand, not read from the paper. */
  example?: boolean;
};

export type Relation = Omit<AnalyzedRelation, "quoteFound"> & { quoteFound?: boolean };

export type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; quotes?: { cite: string; quote: string }[]; error?: boolean }
  | { role: "assistant"; text: string; recs: Recommendation[] };

export type Point = { x: number; y: number };
