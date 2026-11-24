import { create } from "zustand";
import { DEFAULT_SIZE, layoutSections, seed } from "./seed.ts";
import type { AskCitation, AskResponse } from "../../server/ask.ts";
import type { Board, Edge, EdgeKind, Folder, Frame, FrameKind, Lens, Mark, PathStep } from "./types.ts";

/** Bumped when nested canvases were added, so old flat saves are not loaded. */
const STORAGE_KEY = "doubt.canvas.v3";

type Saved = {
  folders: Folder[];
  boards: Record<string, Board>;
  boardId: string;
  path: PathStep[];
};
type Words = { start: number; end: number };

type CanvasState = Saved & {
  /** Questions waiting on the AI ("") or the last error for them. Not saved. */
  asking: Record<string, string>;
  /** Send a question frame to the AI, with the papers on this board as its sources. */
  askAI(questionId: string): Promise<void>;
  /** Drop-down readings waiting on the AI ("") or the error, keyed by `${edgeId}:${lens}`. Not saved. */
  looking: Record<string, string>;
  /** Ask the AI how the two ends of a drawn line connect, sum up, or differ. */
  lookAcross(edgeId: string, lens: Lens): Promise<void>;
  /** Replace what is inside a paper with the sections read from a PDF. */
  fillPaper(frameId: string, title: string, sections: { heading: string; text: string }[]): void;

  openBoard(id: string): void;
  /** Go inside a frame that has an `inside` board (TouchDesigner Enter Component). */
  enter(frameId: string): boolean;
  /** Go up one level (TouchDesigner `u`). */
  up(): boolean;
  /** Jump to a step in the path bar. */
  goTo(index: number): void;
  toggleFolder(id: string): void;
  addFolder(): string;
  addBoard(folderId: string): string;
  rename(id: string, name: string): void;
  removeFolder(id: string): void;
  removeBoard(id: string): void;
  reset(): void;

  addFrame(kind: FrameKind, x: number, y: number, extra?: Partial<Frame>): string;
  patchFrame(id: string, patch: Partial<Frame>): void;
  setText(id: string, text: string): void;
  removeFrame(id: string): void;
  /** Draw a line. With `words`, it starts at those words and underlines them. */
  link(kind: EdgeKind, from: string, words: Words | null, to: string): void;
  removeEdge(id: string): void;
};

export const uid = () => Math.random().toString(36).slice(2, 10);

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Saved;
      if (data.path?.length && data.boards && data.boardId) return data;
    }
  } catch {
    // Unreadable save: fall through to the starting board.
  }
  return seed();
}

/**
 * Keep marks on the right words after the text is edited. Only the edited
 * stretch is compared, so typing before, after or inside a mark keeps it.
 * A mark is dropped when the edit crosses one of its ends.
 */
function remapMarks(marks: Mark[], before: string, after: string): Mark[] {
  let head = 0;
  while (head < before.length && head < after.length && before[head] === after[head]) head++;
  let tail = 0;
  while (
    tail < before.length - head &&
    tail < after.length - head &&
    before[before.length - 1 - tail] === after[after.length - 1 - tail]
  ) {
    tail++;
  }
  const editEnd = before.length - tail;
  const shift = after.length - before.length;

  return marks.flatMap((mark) => {
    if (mark.end <= head) return [mark];
    if (mark.start >= editEnd) return [{ ...mark, start: mark.start + shift, end: mark.end + shift }];
    if (mark.start <= head && mark.end >= editEnd && mark.end + shift > mark.start) {
      return [{ ...mark, end: mark.end + shift }];
    }
    return [];
  });
}

/**
 * Put an AI answer into its question frame. Each cited run of the answer is
 * underlined and linked to a card holding the exact passage; the card's label
 * names the section it came from. Cards from an earlier answer are replaced.
 */
function placeAnswer(
  board: Board,
  questionId: string,
  result: { answer: string; citations: AskCitation[] },
  docs: { label: string }[],
): Board {
  const question = board.frames.find((f) => f.id === questionId);
  if (!question) return board;

  const oldCards = new Set(board.frames.filter((f) => f.madeBy === questionId).map((f) => f.id));
  let frames = board.frames.filter((f) => !oldCards.has(f.id));
  let edges = board.edges.filter((e) => !(e.from === questionId && e.kind === "source"));

  const marks: Mark[] = [];
  const cards = new Map<string, Frame>();
  const newEdges: Edge[] = [];
  const x = question.x + question.w + 80;
  let y = question.y;
  const free = (top: number) =>
    frames.every((f) => x >= f.x + f.w + 20 || x + 300 <= f.x || top >= f.y + f.h + 20 || top + 100 <= f.y);

  for (const c of result.citations) {
    const doc = docs[c.doc];
    if (!doc || !c.quote) continue;
    const key = `${c.doc}:${c.quote}`;
    let card = cards.get(key);
    if (!card) {
      while (!free(y)) y += 40;
      card = {
        id: uid(),
        kind: "card",
        x,
        y,
        w: 300,
        h: 60,
        title: doc.label,
        text: `“${c.quote}”`,
        marks: [],
        src: "",
        quote: "",
        inside: "",
        madeBy: questionId,
      };
      cards.set(key, card);
      frames = [...frames, card];
      y += 120;
    }
    let mark = marks.find((m) => m.start === c.start && m.end === c.end);
    if (!mark) {
      mark = { id: uid(), kind: "source", start: c.start, end: c.end };
      marks.push(mark);
    }
    newEdges.push({ id: uid(), kind: "source", from: questionId, mark: mark.id, to: card.id });
  }

  frames = frames.map((f) => (f.id === questionId ? { ...f, text: result.answer, marks } : f));
  edges = [...edges, ...newEdges];
  return tidy({ ...board, frames, edges });
}

/** Everything a frame says, as plain text: a closed paper brings the sections inside it. */
function textOf(frame: Frame, boards: Record<string, Board>): string {
  const inner = frame.inside ? boards[frame.inside] : undefined;
  const parts = [frame.title, frame.quote ? `“${frame.quote}”` : "", frame.text];
  for (const g of inner?.frames ?? []) if (g.text.trim()) parts.push(`${g.title}\n${g.text}`);
  if (frame.kind === "link" && frame.src) parts.push(frame.src);
  return parts.filter((p) => p.trim()).join("\n\n");
}

export const nameOf = (f: Frame) =>
  f.title.trim() || { paper: "Paper", doc: "My doc", card: "Card", sticky: "Note", question: "Question", image: "Image", video: "Video", link: "Link" }[f.kind];

/** What each choice in a line's drop-down asks. */
const LENS_QUESTION: Record<Lens, string> = {
  connection: "How are these two connected? Point to what one says that relates to the other.",
  summary: "Summarize what these two say together, in 2 to 4 sentences.",
  difference: "Where do these two differ or disagree? If they do not differ, say so.",
};

/**
 * The thread a question continues: the frames its branch lines come from,
 * oldest first. Questions in one thread share what was asked and answered, so
 * the conversation stays on track however far it spreads across the board.
 */
function threadOf(board: Board, questionId: string, depth = 8): Frame[] {
  const out: Frame[] = [];
  let id = questionId;
  for (let i = 0; i < depth; i++) {
    const into = board.edges.find((e) => e.to === id && e.kind === "branch");
    const origin = board.frames.find((f) => f.id === into?.from);
    if (!origin || out.includes(origin)) break;
    out.unshift(origin);
    id = origin.id;
  }
  return out;
}

/** Drop lines that lost an end, and underlines that lost their line. */
function tidy(board: Board): Board {
  const frameIds = new Set(board.frames.map((f) => f.id));
  const markIds = new Set(board.frames.flatMap((f) => f.marks.map((m) => m.id)));
  const edges = board.edges.filter(
    (e) => frameIds.has(e.from) && frameIds.has(e.to) && (!e.mark || markIds.has(e.mark)),
  );
  const used = new Set(edges.map((e) => e.mark));
  const frames = board.frames.map((f) =>
    f.marks.every((m) => used.has(m.id)) ? f : { ...f, marks: f.marks.filter((m) => used.has(m.id)) },
  );
  return { ...board, frames, edges };
}

export const useCanvas = create<CanvasState>((set, get) => {
  const edit = (change: (board: Board) => Board) =>
    set((s) => {
      const board = s.boards[s.boardId];
      return board ? { boards: { ...s.boards, [board.id]: change(board) } } : s;
    });

  const editFrame = (id: string, change: (frame: Frame) => Frame) =>
    edit((b) => ({ ...b, frames: b.frames.map((f) => (f.id === id ? change(f) : f)) }));

  return {
    ...load(),
    asking: {},
    looking: {},

    lookAcross: async (edgeId, lens) => {
      const s = get();
      const boardId = s.boardId;
      const board = s.boards[boardId];
      const edge = board?.edges.find((e) => e.id === edgeId);
      const key = `${edgeId}:${lens}`;
      if (!board || !edge || s.looking[key] === "") return;
      const setLooking = (value: string | null) =>
        set((st) => {
          const looking = { ...st.looking };
          if (value === null) delete looking[key];
          else looking[key] = value;
          return { looking };
        });

      const ends = [edge.from, edge.to].map((id) => board.frames.find((f) => f.id === id));
      const docs = ends.flatMap((f) => (f ? [{ title: nameOf(f), text: textOf(f, s.boards) }] : []));
      if (docs.length < 2 || docs.some((d) => !d.text.trim())) {
        setLooking("One end of this line has no text to read yet. Add text or a PDF to it.");
        return;
      }
      setLooking("");
      let result: AskResponse;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: LENS_QUESTION[lens], quote: "", context: "", docs }),
        });
        result = res.ok ? ((await res.json()) as AskResponse) : { error: "This needs the dev server. Run npm run dev." };
      } catch {
        result = { error: "This needs the dev server. Run npm run dev." };
      }
      if ("error" in result) {
        setLooking(result.error);
        return;
      }
      setLooking(null);
      const seen = new Set<string>();
      const quotes = result.citations.flatMap((c) => {
        if (seen.has(c.quote) || !docs[c.doc]) return [];
        seen.add(c.quote);
        return [{ cite: docs[c.doc].title, quote: c.quote }];
      });
      set((st) => {
        const b = st.boards[boardId];
        if (!b) return st;
        const edges = b.edges.map((e) =>
          e.id === edgeId ? { ...e, lenses: { ...e.lenses, [lens]: { answer: result.answer, quotes } } } : e,
        );
        return { boards: { ...st.boards, [boardId]: { ...b, edges } } };
      });
    },

    askAI: async (questionId) => {
      const s = get();
      const boardId = s.boardId;
      const board = s.boards[boardId];
      const question = board?.frames.find((f) => f.id === questionId);
      if (!board || !question || s.asking[questionId] === "") return;

      // Sources: every paper on this board, and the sections inside closed papers.
      const docs: { title: string; text: string; label: string }[] = [];
      for (const f of board.frames) {
        if (f.kind === "paper" && f.text.trim()) {
          docs.push({ title: f.title || "Paper", text: f.text, label: f.title || "Paper" });
        }
        const inner = f.inside ? s.boards[f.inside] : undefined;
        for (const g of inner?.frames ?? []) {
          if (g.kind === "paper" && g.text.trim()) {
            docs.push({ title: `${f.title} — ${g.title}`, text: g.text, label: g.title });
          }
        }
      }

      // What it continues: every earlier question, answer and note in this thread.
      const context = threadOf(board, questionId)
        .filter((f) => f.kind !== "paper")
        .map((f) =>
          f.kind === "question"
            ? `Q: ${f.title}${f.text ? `\nA: ${f.text}` : ""}`
            : `${nameOf(f)}:\n${f.text || f.src}`,
        )
        .join("\n\n");

      const setAsking = (value: string | null) =>
        set((st) => {
          const asking = { ...st.asking };
          if (value === null) delete asking[questionId];
          else asking[questionId] = value;
          return { asking };
        });
      setAsking("");

      let result: AskResponse;
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: question.title,
            quote: question.quote,
            context,
            docs: docs.map(({ title, text }) => ({ title, text })),
          }),
        });
        result = res.ok
          ? ((await res.json()) as AskResponse)
          : { error: "Answers need the dev server. Run npm run dev." };
      } catch {
        result = { error: "Answers need the dev server. Run npm run dev." };
      }
      if ("error" in result) {
        setAsking(result.error);
        return;
      }
      setAsking(null);
      set((st) => {
        const b = st.boards[boardId];
        return b ? { boards: { ...st.boards, [boardId]: placeAnswer(b, questionId, result, docs) } } : st;
      });
    },

    fillPaper: (frameId, title, sections) =>
      set((s) => {
        const board = s.boards[s.boardId];
        const paper = board?.frames.find((f) => f.id === frameId);
        const inner = paper?.inside ? s.boards[paper.inside] : undefined;
        if (!board || !paper || !inner) return s;
        return {
          boards: {
            ...s.boards,
            [board.id]: {
              ...board,
              frames: board.frames.map((f) => (f.id === frameId ? { ...f, title } : f)),
            },
            [inner.id]: { ...inner, name: title, frames: layoutSections(sections), edges: [] },
          },
        };
      }),

    openBoard: (id) => set({ boardId: id, path: [{ boardId: id, frameId: "" }] }),

    enter: (frameId) => {
      const s = get();
      const board = s.boards[s.boardId];
      const frame = board?.frames.find((f) => f.id === frameId);
      if (!frame?.inside || !s.boards[frame.inside]) return false;
      set({
        boardId: frame.inside,
        path: [...s.path, { boardId: frame.inside, frameId }],
      });
      return true;
    },

    up: () => {
      const s = get();
      if (s.path.length < 2) return false;
      const path = s.path.slice(0, -1);
      set({ path, boardId: path[path.length - 1].boardId });
      return true;
    },

    goTo: (index) =>
      set((s) => {
        if (index < 0 || index >= s.path.length) return s;
        const path = s.path.slice(0, index + 1);
        return { path, boardId: path[path.length - 1].boardId };
      }),

    toggleFolder: (id) =>
      set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, open: !f.open } : f)) })),

    addFolder: () => {
      const id = uid();
      set((s) => ({ folders: [...s.folders, { id, name: "New folder", open: true, boards: [] }] }));
      return id;
    },

    addBoard: (folderId) => {
      const id = uid();
      set((s) => ({
        boards: { ...s.boards, [id]: { id, name: "Untitled board", frames: [], edges: [] } },
        folders: s.folders.map((f) => (f.id === folderId ? { ...f, open: true, boards: [...f.boards, id] } : f)),
        boardId: id,
        path: [{ boardId: id, frameId: "" }],
      }));
      return id;
    },

    rename: (id, name) =>
      set((s) => ({
        folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
        boards: s.boards[id] ? { ...s.boards, [id]: { ...s.boards[id], name } } : s.boards,
      })),

    removeBoard: (id) =>
      set((s) => {
        const boards = { ...s.boards };
        delete boards[id];
        const folders = s.folders.map((f) => ({ ...f, boards: f.boards.filter((b) => b !== id) }));
        const next = folders.flatMap((f) => f.boards)[0] ?? "";
        const boardId = s.boardId === id ? next : s.boardId;
        return {
          boards,
          folders,
          boardId,
          path: s.boardId === id ? [{ boardId: next, frameId: "" }] : s.path,
        };
      }),

    removeFolder: (id) =>
      set((s) => {
        const gone = s.folders.find((f) => f.id === id)?.boards ?? [];
        const boards = { ...s.boards };
        for (const boardId of gone) delete boards[boardId];
        const folders = s.folders.filter((f) => f.id !== id);
        const next = folders.flatMap((f) => f.boards)[0] ?? "";
        const boardId = gone.includes(s.boardId) ? next : s.boardId;
        return {
          boards,
          folders,
          boardId,
          path: gone.includes(s.boardId) ? [{ boardId: next, frameId: "" }] : s.path,
        };
      }),

    reset: () => set(seed()),

    addFrame: (kind, x, y, extra) => {
      const id = uid();
      // A paper always holds a canvas you can zoom into, like a TouchDesigner Component.
      let inside = extra?.inside ?? "";
      const boards: Record<string, Board> = {};
      if (kind === "paper" && !inside) {
        inside = uid();
        boards[inside] = {
          id: inside,
          name: extra?.title || "Untitled paper",
          frames: [],
          edges: [],
        };
      }
      const frame: Frame = {
        id,
        kind,
        x,
        y,
        ...DEFAULT_SIZE[kind],
        title: "",
        text: "",
        marks: [],
        src: "",
        quote: "",
        ...extra,
        inside: extra?.inside || inside,
      };
      set((s) => {
        const board = s.boards[s.boardId];
        if (!board) return s;
        return {
          boards: {
            ...s.boards,
            ...boards,
            [board.id]: { ...board, frames: [...board.frames, frame] },
          },
        };
      });
      return id;
    },

    patchFrame: (id, patch) => {
      editFrame(id, (f) => ({ ...f, ...patch }));
      // Keep the inner board's name in step with the paper's title.
      if (patch.title !== undefined) {
        const frame = get().boards[get().boardId]?.frames.find((f) => f.id === id);
        if (frame?.inside) {
          set((s) => {
            const inner = s.boards[frame.inside];
            return inner
              ? { boards: { ...s.boards, [inner.id]: { ...inner, name: patch.title || inner.name } } }
              : s;
          });
        }
      }
    },

    setText: (id, text) =>
      edit((b) =>
        tidy({
          ...b,
          frames: b.frames.map((f) =>
            f.id === id ? { ...f, text, marks: remapMarks(f.marks, f.text, text) } : f,
          ),
        }),
      ),

    removeFrame: (id) => edit((b) => tidy({ ...b, frames: b.frames.filter((f) => f.id !== id) })),

    link: (kind, from, words, to) =>
      edit((b) => {
        let frames = b.frames;
        let markId: string | undefined;
        if (words) {
          const origin = frames.find((f) => f.id === from);
          if (!origin) return b;
          const same = origin.marks.find(
            (m) => m.kind === kind && m.start === words.start && m.end === words.end,
          );
          const mark = same ?? { id: uid(), kind, start: words.start, end: words.end };
          markId = mark.id;
          if (!same) {
            frames = frames.map((f) => (f.id === from ? { ...f, marks: [...f.marks, mark] } : f));
          }
        }
        const exists = b.edges.some(
          (e) => e.kind === kind && e.from === from && e.mark === markId && e.to === to,
        );
        const edges = exists ? b.edges : [...b.edges, { id: uid(), kind, from, mark: markId, to }];
        return { ...b, frames, edges };
      }),

    removeEdge: (id) => edit((b) => tidy({ ...b, edges: b.edges.filter((e) => e.id !== id) })),
  };
});

let saveTimer = 0;
useCanvas.subscribe(({ folders, boards, boardId, path }) => {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ folders, boards, boardId, path }));
    } catch {
      // Storage is full or blocked. The board keeps working until the page closes.
    }
  }, 200);
});
