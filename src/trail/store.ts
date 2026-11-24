import { create } from "zustand";
import type { AskResponse } from "../../server/ask.ts";
import type { ReadResponse, RecheckResponse, Recommendation, RecommendResponse } from "../../server/trail.ts";
import { EXAMPLE_CHECKS, EXAMPLE_NOTES, EXAMPLE_PAPERS, sentencesOf } from "./content.ts";
import type { Check } from "./content.ts";

const STORAGE_KEY = "doubt.trail.v2";

export type Paper = {
  id: string;
  title: string;
  sections: { heading: string; text: string }[];
  url?: string;
  /** Shown under the title, such as "Web page, first part only". */
  note?: string;
  example?: boolean;
};

/** A traced sentence pinned to the top of the assistant to ask about. */
export type Branch = { sentence: string; check: Check };

export type Message =
  | { role: "user"; text: string; branch?: Branch }
  | { role: "assistant"; text: string; quotes?: { cite: string; quote: string }[]; error?: boolean }
  | { role: "assistant"; recs: Recommendation[]; text: string };

type Saved = { notes: string; checks: Record<string, Check>; papers: Paper[]; messages: Message[] };

type TrailState = Saved & {
  branch: Branch | null;
  checking: boolean;
  asking: boolean;
  recommending: boolean;
  checkError: string;
  /** Recommendation URLs being added ("") or the error for each. */
  adding: Record<string, string>;
  setNotes(notes: string): void;
  recheck(): Promise<void>;
  addPaper(paper: Omit<Paper, "id">): void;
  removePaper(id: string): void;
  pin(branch: Branch | null): void;
  ask(question: string): Promise<void>;
  recommend(): Promise<void>;
  addRecommended(rec: Recommendation): Promise<void>;
  reset(): void;
};

const start = (): Saved => ({
  notes: EXAMPLE_NOTES,
  checks: { ...EXAMPLE_CHECKS },
  papers: EXAMPLE_PAPERS.map((p) => ({ ...p })),
  messages: [],
});

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Saved;
      if (typeof data.notes === "string" && Array.isArray(data.papers)) return { ...start(), ...data };
    }
  } catch {
    // Unreadable save: start from the example.
  }
  return start();
}

const uid = () => Math.random().toString(36).slice(2, 8);

async function post<T>(path: string, body: unknown, fallback: string): Promise<T | { error: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok ? ((await res.json()) as T) : { error: fallback };
  } catch {
    return { error: "Could not reach the dev server." };
  }
}

/** Every section of every paper with text is its own document, so a quote can say where it came from. */
function docsOf(papers: Paper[]) {
  return papers.flatMap((p) =>
    p.sections
      .filter((s) => s.text.trim())
      .map((s) => ({ title: `${p.title} · ${s.heading}`, text: s.text, cite: `${s.heading} · ${p.title}` })),
  );
}

export const useTrail = create<TrailState>((set, get) => ({
  ...load(),
  branch: null,
  checking: false,
  asking: false,
  recommending: false,
  checkError: "",
  adding: {},

  setNotes: (notes) => set({ notes }),

  async recheck() {
    const sentences = sentencesOf(get().notes).flat();
    const docs = docsOf(get().papers);
    set({ checking: true, checkError: "" });
    const result = await post<RecheckResponse>(
      "/api/recheck",
      { sentences, docs: docs.map(({ title, text }) => ({ title, text })) },
      "Rechecking needs the dev server (npm run dev).",
    );
    if ("error" in result) {
      set({ checking: false, checkError: result.error });
      return;
    }
    const checks: Record<string, Check> = {};
    for (const c of result.checks) {
      checks[sentences[c.index]] = {
        verdict: c.verdict,
        phrase: c.phrase,
        cite: c.doc >= 0 ? docs[c.doc].cite : "",
        quote: c.quote,
        quoteFound: c.quoteFound,
      };
    }
    set({ checking: false, checks, branch: null });
  },

  addPaper(paper) {
    // The first real paper replaces the example papers, which have no text.
    set({ papers: [...get().papers.filter((p) => !p.example), { ...paper, id: uid() }] });
  },

  removePaper: (id) => set({ papers: get().papers.filter((p) => p.id !== id) }),

  pin: (branch) => set({ branch }),

  async ask(question) {
    const q = question.trim();
    if (!q || get().asking) return;
    const branch = get().branch;
    const say = (m: Message) => set({ messages: [...get().messages, m] });
    say({ role: "user", text: q, ...(branch ? { branch } : {}) });
    const docs = docsOf(get().papers);
    set({ asking: true });
    const result = await post<AskResponse>(
      "/api/ask",
      {
        question: q,
        quote: branch?.check.phrase ?? "",
        context: branch
          ? `From my notes: “${branch.sentence}”${branch.check.quote ? `\nTraced to ${branch.check.cite}: “${branch.check.quote}”` : "\nNo paper in my library covers it."}`
          : "",
        docs: docs.map(({ title, text }) => ({ title, text })),
      },
      "Answers need the dev server (npm run dev).",
    );
    set({ asking: false });
    if ("error" in result) {
      say({ role: "assistant", text: result.error, error: true });
      return;
    }
    const seen = new Set<string>();
    const quotes = result.citations.flatMap((c) => {
      if (seen.has(c.quote) || !docs[c.doc]) return [];
      seen.add(c.quote);
      return [{ cite: docs[c.doc].cite, quote: c.quote }];
    });
    say({ role: "assistant", text: result.answer, quotes });
  },

  async recommend() {
    if (get().recommending) return;
    set({ recommending: true });
    const result = await post<RecommendResponse>(
      "/api/recommend",
      { notes: get().notes, library: get().papers.map((p) => p.title) },
      "Recommendations need the dev server (npm run dev).",
    );
    set({ recommending: false });
    const say = (m: Message) => set({ messages: [...get().messages, m] });
    if ("error" in result) say({ role: "assistant", text: result.error, error: true });
    else say({ role: "assistant", text: "Papers related to your notes, found by web search:", recs: result.papers });
  },

  async addRecommended(rec) {
    set({ adding: { ...get().adding, [rec.url]: "" } });
    const page = await post<ReadResponse>("/api/read", { url: rec.url }, "Adding needs the dev server.");
    if ("error" in page) {
      set({ adding: { ...get().adding, [rec.url]: page.error } });
      return;
    }
    get().addPaper({
      title: rec.title,
      url: rec.url,
      note: page.cut ? "Web page, first part only" : "Web page",
      sections: [{ heading: "Web page", text: page.text }],
    });
    const { [rec.url]: _done, ...adding } = get().adding;
    set({ adding });
  },

  reset: () => set({ ...start(), branch: null, checkError: "", adding: {} }),
}));

useTrail.subscribe((s) => {
  const saved: Saved = { notes: s.notes, checks: s.checks, papers: s.papers, messages: s.messages };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage full (big PDFs). The page still works until it is closed.
  }
});
