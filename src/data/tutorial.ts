import type { Condition, Scenario } from "../types.ts";

/** Practice chat. Not scored. One claim of each quadrant, spread over three turns. */
export const tutorialScenario: Scenario = {
  id: "tutorial",
  brief: "Practice. This chat is not scored. Try opening the marks, then continue.",
  decision: {
    prompt: "",
    options: [],
    correct_option: "",
    rationale_claim_ids: [],
  },
  claims: [
    {
      id: "tc1",
      text: "The Eiffel Tower was completed in 1889.",
      consistency: { agree: 10, total: 10, alternatives: [] },
      verdict: "SUPPORTED",
      evidence_ids: ["tp1"],
      is_planted_error: false,
      key_claim: false,
      source_says: "1889",
      key_span: "1889",
      branches: [{ value: "1889", count: 10, source: "support" }],
    },
    {
      id: "tc2",
      text: "It stayed the world's tallest structure until the Chrysler Building in 1930.",
      consistency: { agree: 4, total: 10, alternatives: ["1929", "1931"] },
      verdict: "SUPPORTED",
      evidence_ids: ["tp2"],
      is_planted_error: false,
      key_claim: false,
      source_says: "1930",
      key_span: "1930",
      branches: [
        { value: "1930", count: 4, source: "support" },
        { value: "1929", count: 3 },
        { value: "1931", count: 3 },
      ],
    },
    {
      id: "tc3",
      text: "Eiffel first offered the design to Lyon.",
      consistency: { agree: 3, total: 10, alternatives: ["Barcelona"] },
      verdict: "REFUTED",
      evidence_ids: ["tp3"],
      is_planted_error: false,
      key_claim: false,
      source_says: "Barcelona",
      key_span: "Lyon",
      branches: [
        { value: "Lyon", count: 3 },
        { value: "Barcelona", count: 7, source: "support" },
      ],
    },
    {
      id: "tc4",
      text: "It was built for the 1900 World's Fair.",
      consistency: { agree: 8, total: 10, alternatives: ["1889"] },
      verdict: "REFUTED",
      evidence_ids: ["tp1"],
      is_planted_error: false,
      key_claim: false,
      source_says: "1889",
      key_span: "1900",
      branches: [
        { value: "1900", count: 8 },
        { value: "1889", count: 2, source: "support" },
      ],
    },
    {
      id: "tc5",
      text: "In strong winds the top sways by 15 cm.",
      consistency: { agree: 8, total: 10, alternatives: ["7 cm"] },
      verdict: "NEI",
      evidence_ids: [],
      is_planted_error: false,
      key_claim: false,
      key_span: "15 cm",
      branches: [
        { value: "15 cm", count: 8 },
        { value: "7 cm", count: 2 },
      ],
    },
  ],
  passages: [
    {
      id: "tp1",
      source_title: "Practice source",
      text: "The tower was completed in 1889 for that year's exposition. It was not built for the 1900 fair.",
    },
    {
      id: "tp2",
      source_title: "Height note",
      text: "The Chrysler Building in New York passed it in 1930.",
    },
    {
      id: "tp3",
      source_title: "Design note",
      text: "Eiffel first offered the design to Barcelona, not to Lyon.",
    },
  ],
  extra_passages: [],
  start_node: "t_n1",
  fallback_node: "t_fallback",
  nodes: [
    {
      id: "t_n1",
      source_ids: ["tp1", "tp2"],
      segments: [
        { kind: "text", text: "Here's a short practice. " },
        { kind: "claim", claim_id: "tc1" },
        { kind: "text", text: " " },
        { kind: "claim", claim_id: "tc2" },
        { kind: "text", text: " Open whatever is marked, if anything is." },
      ],
      chips: [{ label: "What else is often repeated?", goto: "t_n2" }],
      intents: [
        { keywords: ["else", "lyon", "offered", "design"], goto: "t_n2" },
        { keywords: ["fair", "sway", "wind"], goto: "t_n3" },
      ],
    },
    {
      id: "t_n2",
      source_ids: ["tp3"],
      segments: [
        { kind: "text", text: "Another line people repeat: " },
        { kind: "claim", claim_id: "tc3" },
        { kind: "text", text: " That's a different kind of uncertainty from the date above." },
      ],
      chips: [{ label: "And the fair?", goto: "t_n3" }],
      intents: [
        { keywords: ["fair", "sway", "wind", "1900"], goto: "t_n3" },
        { keywords: ["1889", "chrysler", "tall"], goto: "t_n1" },
      ],
    },
    {
      id: "t_n3",
      source_ids: ["tp1"],
      segments: [
        { kind: "text", text: "Two more lines show up often. " },
        { kind: "claim", claim_id: "tc4" },
        { kind: "text", text: " " },
        { kind: "claim", claim_id: "tc5" },
        { kind: "text", text: " When you're ready, continue to the study." },
      ],
      chips: [],
      intents: [
        { keywords: ["1889", "chrysler", "tall"], goto: "t_n1" },
        { keywords: ["lyon", "offered"], goto: "t_n2" },
      ],
    },
    {
      id: "t_fallback",
      source_ids: [],
      segments: [
        {
          kind: "text",
          text: "This practice is only about the tower's date, the height record, the first offer, and the fair. What would you like to ask?",
        },
      ],
      chips: [
        { label: "What else is often repeated?", goto: "t_n2" },
        { label: "And the fair?", goto: "t_n3" },
      ],
      intents: [
        { keywords: ["lyon", "offered", "design"], goto: "t_n2" },
        { keywords: ["fair", "sway", "wind"], goto: "t_n3" },
        { keywords: ["1889", "chrysler"], goto: "t_n1" },
      ],
    },
  ],
};

export const tutorialTips: Record<Exclude<Condition, "A">, Record<string, string>> = {
  B: {
    t_n1: "A dotted line means the sampled answers did not all match. Open it to see how many agreed. A sentence with no line was the same in every sample.",
    t_n2: "Same mark as before. In this condition every disagreement looks the same. The popover only tells you about the samples, not the sources.",
    t_n3: "These lines were repeated often, so the dotted mark still only means the samples were not unanimous. Continue when you've tried opening one.",
  },
  C: {
    t_n1: "Sentences the sources support have no underline. Open a source chip under the message if you want the page.",
    t_n2: "The underline means the sources do not simply support the sentence. Open it. 'Sources disagree' is different from 'No source covers this'.",
    t_n3: "Both lines are underlined, but the notes are not the same. One is contradicted. The other is not covered. Continue when you've opened one.",
  },
  D: {
    t_n1: "No mark means the samples agreed and a source supports it. A dotted line means the wording varied, and the source still has an answer. Open the dotted one.",
    t_n2: "The line and the ? mean the samples varied and the sources do not confirm it. Open it, then you can ask the chat about that doubt.",
    t_n3: "A note after the sentence is there without a tap. Read both. 'Sources disagree' and 'no source confirms it' ask different things of you. Then continue.",
  },
};
