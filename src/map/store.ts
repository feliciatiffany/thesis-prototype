import { create } from "zustand";
import type { AnalyzeResponse } from "../../server/analyze.ts";
import type { AskResponse } from "../../server/ask.ts";
import type { ReadResponse, Recommendation, RecommendResponse } from "../../server/trail.ts";
import { layout } from "./layout.ts";
import { SEED_POSITIONS, SEED_RELATIONS, SEED_SOURCES } from "./seed.ts";
import type { MapSource, Message, Point, Relation } from "./types.ts";

const STORAGE_KEY = "doubt.map.v2";

type Saved = {
  sources: MapSource[];
  relations: Relation[];
  positions: Record<string, Point>;
  messages: Message[];
};

type MapState = Saved & {
  selected: string | null;
  analyzing: boolean;
  asking: boolean;
  /** Paper id whose related research is being searched. */
  digging: string | null;
  error: string;
  notes: string[];
  /** Recommendation URLs being added ("") or the error for each. */
  adding: Record<string, string>;
  addPaper(title: string, text: string): void;
  addLink(url: string, title?: string, text?: string): void;
  removeSource(id: string): void;
  select(id: string | null): void;
  move(id: string, p: Point): void;
  analyze(): Promise<void>;
  ask(question: string): Promise<void>;
  digDown(id: string): Promise<void>;
  addRecommended(rec: Recommendation): Promise<void>;
  loadExample(): void;
  clear(): void;
};

const example = (): Saved => ({
  sources: SEED_SOURCES.map((s) => ({ ...s })),
  relations: SEED_RELATIONS.map((r) => ({ ...r })),
  positions: { ...SEED_POSITIONS },
  messages: [],
});

function load(): Saved {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw) as Saved;
      if (Array.isArray(data.sources)) return { ...example(), ...data };
    }
  } catch {
    // Unreadable save: start from the example.
  }
  return example();
}

const uid = () => Math.random().toString(36).slice(2, 8);
const nameOf = (s: MapSource) => s.label ?? s.title;

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

/** Give every new paper a place, keeping the ones already placed. */
const placed = (sources: MapSource[], relations: Relation[], positions: Record<string, Point>) =>
  layout(
    sources.map((s) => s.id),
    relations,
    positions,
  );

// Papers are analyzed as soon as they are added. Adding several in a row runs one analysis.
let timer: number | undefined;
let again = false;

export const useMap = create<MapState>((set, get) => {
  const add = (source: MapSource) => {
    // The first real paper replaces the example, which has no text.
    const keep = get().sources.filter((s) => !s.example);
    const relations = get().relations.filter((r) => keep.some((s) => s.id === r.from) && keep.some((s) => s.id === r.to));
    const sources = [...keep, source];
    const positions = Object.fromEntries(Object.entries(get().positions).filter(([id]) => keep.some((s) => s.id === id)));
    set({ sources, relations, positions: placed(sources, relations, positions), selected: source.id });
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void get().analyze(), 400);
  };

  return {
    ...load(),
    selected: null,
    analyzing: false,
    asking: false,
    digging: null,
    error: "",
    notes: [],
    adding: {},

    addPaper: (title, text) => add({ id: `p-${uid()}`, kind: "paper", title, text }),
    addLink(url, title, text) {
      // The same link twice would show up as two papers; select the one already there.
      const same = get().sources.find((s) => s.url === url);
      if (same) set({ selected: same.id });
      else add({ id: `l-${uid()}`, kind: "link", title: title ?? url, url, text });
    },

    removeSource(id) {
      const { [id]: _gone, ...positions } = get().positions;
      set({
        sources: get().sources.filter((s) => s.id !== id),
        relations: get().relations.filter((r) => r.from !== id && r.to !== id),
        positions,
        selected: get().selected === id ? null : get().selected,
      });
    },

    select: (selected) => set({ selected }),
    move: (id, p) => set({ positions: { ...get().positions, [id]: p } }),

    async analyze() {
      if (get().analyzing) {
        again = true;
        return;
      }
      const sources = get().sources.filter((s) => !s.example);
      if (sources.length === 0) return;
      set({ analyzing: true, error: "", notes: [] });
      const result = await post<AnalyzeResponse>(
        "/api/analyze",
        { sources: sources.map((s) => ({ id: s.id, title: s.title, url: s.url, text: s.text })) },
        "The analysis needs the dev server (npm run dev).",
      );
      if ("error" in result) {
        set({ analyzing: false, error: result.error });
      } else {
        const byId = new Map(result.sources.map((s) => [s.id, s]));
        const next = get().sources.map((s) => {
          const found = byId.get(s.id);
          return found
            ? { ...s, label: found.label, summary: found.summary, title: found.pageTitle ?? s.title, text: s.text ?? found.text }
            : s;
        });
        // Re-place only papers that were never placed; papers someone moved stay put.
        set({
          analyzing: false,
          sources: next,
          relations: result.relations,
          positions: placed(next, result.relations, get().positions),
          notes: result.notes,
        });
      }
      if (again) {
        again = false;
        void get().analyze();
      }
    },

    async ask(question) {
      const q = question.trim();
      if (!q || get().asking) return;
      const say = (m: Message) => set({ messages: [...get().messages, m] });
      say({ role: "user", text: q });
      const { sources, relations } = get();
      const docs = sources.filter((s) => s.text?.trim()).map((s) => ({ title: nameOf(s), text: s.text! }));
      if (docs.length === 0) {
        say({ role: "assistant", error: true, text: "Add a paper first. The example papers have no text to answer from." });
        return;
      }
      // The map itself goes along, so questions about how papers relate can use it.
      const byId = (id: string) => sources.find((s) => s.id === id);
      const map = relations
        .map((r) => `${nameOf(byId(r.from)!)} ${r.label} ${nameOf(byId(r.to)!)}: ${r.why}`)
        .join("\n");
      set({ asking: true });
      const result = await post<AskResponse>(
        "/api/ask",
        { question: q, quote: "", context: map ? `How the papers relate, from the source map:\n${map}` : "", docs },
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
        return [{ cite: docs[c.doc].title, quote: c.quote }];
      });
      say({ role: "assistant", text: result.answer, quotes });
    },

    async digDown(id) {
      const source = get().sources.find((s) => s.id === id);
      if (!source || get().digging) return;
      const say = (m: Message) => set({ messages: [...get().messages, m] });
      say({ role: "user", text: `Find more research related to ${nameOf(source)}.` });
      set({ digging: id });
      const result = await post<RecommendResponse>(
        "/api/recommend",
        {
          notes: `Find research related to this paper.\n${source.title}${source.summary ? `\n${source.summary}` : ""}`,
          library: get().sources.map((s) => s.title),
        },
        "Searching needs the dev server (npm run dev).",
      );
      set({ digging: null });
      if ("error" in result) say({ role: "assistant", text: result.error, error: true });
      else say({ role: "assistant", text: `Related to ${nameOf(source)}, found by web search:`, recs: result.papers });
    },

    async addRecommended(rec) {
      set({ adding: { ...get().adding, [rec.url]: "" } });
      const page = await post<ReadResponse>("/api/read", { url: rec.url }, "Adding needs the dev server.");
      if ("error" in page) {
        set({ adding: { ...get().adding, [rec.url]: page.error } });
        return;
      }
      get().addLink(rec.url, rec.title, page.text);
      const { [rec.url]: _done, ...adding } = get().adding;
      set({ adding });
    },

    loadExample: () => set({ ...example(), selected: null, error: "", notes: [] }),
    clear: () => set({ sources: [], relations: [], positions: {}, messages: [], selected: null, error: "", notes: [] }),
  };
});

useMap.subscribe((s) => {
  const saved: Saved = { sources: s.sources, relations: s.relations, positions: s.positions, messages: s.messages };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Storage full (big PDFs). The page still works until it is closed.
  }
});
