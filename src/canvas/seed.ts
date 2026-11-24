import type { Board, Edge, Folder, Frame, FrameKind, Mark, PathStep } from "./types.ts";

import { PAPER } from "./paper.ts";

/**
 * The starting boards: one real paper, "Why Language Models Hallucinate".
 *
 * Outer board: the paper is a closed box. Zoom into it (TouchDesigner-style)
 * to open the inner board, where each section of the paper is its own frame.
 * The abstract's main claims are underlined and linked to the sections that argue them.
 */

export const DEFAULT_SIZE: Record<FrameKind, { w: number; h: number }> = {
  paper: { w: 460, h: 520 },
  doc: { w: 360, h: 260 },
  card: { w: 280, h: 60 },
  sticky: { w: 200, h: 120 },
  question: { w: 300, h: 170 },
  image: { w: 280, h: 200 },
  video: { w: 320, h: 220 },
  link: { w: 260, h: 96 },
};

function frame(
  id: string,
  kind: FrameKind,
  x: number,
  y: number,
  w: number,
  h: number,
  rest: Partial<Frame> = {},
): Frame {
  return {
    id,
    kind,
    x,
    y,
    w,
    h,
    title: "",
    text: "",
    marks: [],
    src: "",
    quote: "",
    inside: "",
    ...rest,
  };
}

function sourceMark(id: string, text: string, words: string): Mark {
  const start = text.indexOf(words);
  if (start < 0) throw new Error(`Seed: "${words}" is not in the text`);
  return { id, start, end: start + words.length, kind: "source" };
}

/** Width of a section frame on the inside board, and the gap between them. */
const SECTION_W = 460;
const SECTION_GAP = 80;

/** Section frames for the inside of a paper, left to right like reading it. */
export function layoutSections(sections: { heading: string; text: string }[]): Frame[] {
  return sections.map((section, i) =>
    frame(`sec-${i}-${Math.random().toString(36).slice(2, 7)}`, "paper", i * (SECTION_W + SECTION_GAP), 0, SECTION_W, 200, {
      title: section.heading,
      text: section.text,
    }),
  );
}

export function seed(): {
  folders: Folder[];
  boards: Record<string, Board>;
  boardId: string;
  path: PathStep[];
} {
  // Inner canvas: the sections, left to right, like reading the paper.
  const insideId = "paper-inside";
  const abstract = PAPER.sections[0].text;
  const insideFrames: Frame[] = PAPER.sections.map((section, i) =>
    frame(section.id, "paper", i * (SECTION_W + SECTION_GAP), 0, SECTION_W, 200, {
      title: section.heading,
      text: section.text,
    }),
  );
  insideFrames[0].marks = [
    sourceMark("m1", abstract, "errors in binary classification"),
    sourceMark("m2", abstract, "guessing when uncertain improves test performance"),
    sourceMark("m3", abstract, "modifying the scoring of existing benchmarks"),
  ];
  const insideEdges: Edge[] = [
    { id: "ie1", kind: "source", from: "sabstract", mark: "m1", to: "s3-1" },
    { id: "ie2", kind: "source", from: "sabstract", mark: "m2", to: "s4-1" },
    { id: "ie3", kind: "source", from: "sabstract", mark: "m3", to: "s4-2" },
  ];
  const inside: Board = { id: insideId, name: PAPER.title, frames: insideFrames, edges: insideEdges };

  // Outer board: the paper is a closed box. Zoom in to enter the inner canvas.
  const outerFrames: Frame[] = [
    frame("paper", "paper", 0, 0, 460, 520, { title: PAPER.title, inside: insideId }),
    frame("summary", "card", 0, 610, 460, 60, {
      title: "Paper summary",
      text: "“Language models hallucinate because the training and evaluation procedures reward guessing over acknowledging uncertainty.”",
    }),
    frame("question-1", "question", 560, 590, 300, 170, {
      title: "Why does guessing beat saying “I don’t know” on most benchmarks?",
    }),
    frame("question-2", "question", 960, 590, 300, 170, {
      title: "What do the authors propose instead of a new hallucination benchmark?",
    }),
    frame("image", "image", 560, 40, 420, 141, {
      title: "Figure 1 · Is-It-Valid",
      src: "/paper/figure-1.png",
    }),
    frame("link", "link", 560, 260, 260, 96, { src: PAPER.url }),
  ];
  const outerEdges: Edge[] = [
    { id: "e1", kind: "branch", from: "paper", to: "summary" },
    { id: "e2", kind: "branch", from: "summary", to: "question-1" },
    { id: "e3", kind: "branch", from: "question-1", to: "question-2" },
    { id: "e4", kind: "connect", from: "image", to: "paper" },
    { id: "e5", kind: "connect", from: "link", to: "paper" },
  ];
  const outer: Board = { id: "board-1", name: PAPER.title, frames: outerFrames, edges: outerEdges };

  return {
    folders: [{ id: "folder-1", name: "Readings", open: true, boards: [outer.id] }],
    boards: { [outer.id]: outer, [inside.id]: inside },
    boardId: outer.id,
    path: [{ boardId: outer.id, frameId: "" }],
  };
}
