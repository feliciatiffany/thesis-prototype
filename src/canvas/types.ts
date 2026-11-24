/** doc: the person's own writing, which they can bridge to papers with lines. */
export type FrameKind = "paper" | "doc" | "card" | "sticky" | "question" | "image" | "video" | "link";

/**
 * The three kinds of line on a board.
 * branch: a question asked from a frame, or something made from it.
 * connect: a link a person drew by hand.
 * source: where words in a reading come from.
 */
export type EdgeKind = "branch" | "connect" | "source";

/** Underlined words in a frame's text. Every mark is the start of at least one edge. */
export type Mark = { id: string; start: number; end: number; kind: EdgeKind };

export type Frame = {
  id: string;
  kind: FrameKind;
  x: number;
  y: number;
  w: number;
  /** Exact height for media. Text frames grow past it. */
  h: number;
  /** Paper title, card label, the question, or a file name. */
  title: string;
  /** The reading, the note, or the AI answer. Marks point into this. */
  text: string;
  marks: Mark[];
  /** Address of an image, video or link. */
  src: string;
  /** On a question: the words it was asked about. */
  quote: string;
  /**
   * Board id of the canvas inside this frame.
   * Like a TouchDesigner Component: zoom in / press i / double-click to enter it.
   */
  inside: string;
  /** On a source card the AI made: the question it belongs to. Asking again replaces these. */
  madeBy?: string;
};

/** What the drop-down on a drawn line can show about the two things it joins. */
export type Lens = "connection" | "summary" | "difference";

/** An AI reading of the two ends of a line, with the passages it quoted. */
export type LensResult = { answer: string; quotes: { cite: string; quote: string }[] };

export type Edge = {
  id: string;
  kind: EdgeKind;
  from: string;
  mark?: string;
  to: string;
  /** On a drawn line: what the drop-down found, kept so it opens instantly next time. */
  lenses?: Partial<Record<Lens, LensResult>>;
};

export type Board = { id: string; name: string; frames: Frame[]; edges: Edge[] };

export type Folder = { id: string; name: string; open: boolean; boards: string[] };

/** Where you are: top-level board first, then each frame you entered. */
export type PathStep = { boardId: string; /** Frame that held this board, empty at the top. */ frameId: string };

export type Rect = { x: number; y: number; w: number; h: number };

/** One line's worth of underlined words, plus the empty space under that line of text. */
export type MarkBox = Rect & { gap: number };
