import type { MapSource, Relation } from "./types.ts";

/**
 * The starting example, from the "prototype- builds" wireframe in FigJam.
 * These summaries and relations were written by hand for the prototype. They
 * were not read from the papers, so the page labels them as an example. Check
 * them against the papers before showing them to anyone as fact.
 */
export const SEED_SOURCES: MapSource[] = [
  {
    id: "mueller",
    kind: "paper",
    title: "The Pen Is Mightier Than the Keyboard (Mueller & Oppenheimer, 2014)",
    label: "Mueller 2014",
    summary:
      "Lab studies where students who wrote notes by hand did better on conceptual questions than students who typed, whose notes copied the lecture more word for word.",
    example: true,
  },
  {
    id: "morehead",
    kind: "paper",
    title: "How Much Mightier Is the Pen Than the Keyboard for Note-Taking? (Morehead, Dunlosky & Rawson, 2019)",
    label: "Morehead 2019",
    summary: "A replication and extension that found smaller and less consistent differences between handwritten and typed notes.",
    example: true,
  },
  {
    id: "urry",
    kind: "paper",
    title: "Don't Ditch the Laptop Just Yet (Urry et al., 2021)",
    label: "Urry 2021",
    summary:
      "A direct replication that did not find the handwriting advantage on conceptual questions, though typed notes were still more word for word.",
    example: true,
  },
  {
    id: "voyer",
    kind: "paper",
    title: "Meta-analysis of handwritten and typed notes (Voyer et al., 2022)",
    label: "Voyer 2022",
    summary: "Pools many studies and reports a small overall advantage for handwritten notes that varies from study to study.",
    example: true,
  },
];

export const SEED_RELATIONS: Relation[] = [
  {
    from: "morehead",
    to: "mueller",
    label: "replicates",
    why: "Repeats Mueller's study and finds a smaller effect, so read the two together before trusting the original size.",
    quote: "",
  },
  {
    from: "voyer",
    to: "mueller",
    label: "reviews",
    why: "Includes Mueller's study in a pooled analysis with many others.",
    quote: "",
  },
  {
    from: "urry",
    to: "morehead",
    label: "compared with",
    why: "Sets its own replication beside Morehead's results.",
    quote: "",
  },
  {
    from: "voyer",
    to: "urry",
    label: "reviews",
    why: "Includes Urry's replication in the pooled analysis.",
    quote: "",
  },
];

/** Hand-placed to match the wireframe. Coordinates run 0 to 1 inside the graph. */
export const SEED_POSITIONS = {
  mueller: { x: 0.28, y: 0.3 },
  morehead: { x: 0.68, y: 0.2 },
  urry: { x: 0.62, y: 0.75 },
  voyer: { x: 0.22, y: 0.82 },
};
