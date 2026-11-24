import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";

/**
 * Source map: reads the papers and links a person added and says how they are
 * related: who replicates, extends, contradicts or reviews whom, so the person
 * can see the background and combine them. Runs on the dev server only, so the
 * API key never reaches the browser.
 *
 * Each relation comes with a quote from the paper that shows it. The quote is
 * checked against the paper text here; one that is not in the text is marked
 * as not found, never shown as real.
 */

export type AnalyzeSource = { id: string; title: string; url?: string; text?: string };
export type AnalyzeRequest = { sources: AnalyzeSource[] };
export type AnalyzedSource = {
  id: string;
  /** Short node label, such as "Mueller 2014". */
  label: string;
  /** What the paper is about and found, in one or two sentences. */
  summary: string;
  /** Text read from a link, so later questions can use it. */
  text?: string;
  /** The page's own title, for a link. */
  pageTitle?: string;
};
export type AnalyzedRelation = {
  from: string;
  to: string;
  /** Verb phrase read as "from <label> to", such as "replicates" or "builds on". */
  label: string;
  /** One sentence on how the two connect. */
  why: string;
  /** Passage from the "from" paper that shows the relation. */
  quote: string;
  quoteFound: boolean;
};
export type AnalyzeResponse =
  | { sources: AnalyzedSource[]; relations: AnalyzedRelation[]; notes: string[] }
  | { error: string };

/** Web pages are long and mostly menus. Keep the first part, and say so. */
const LINK_CHARS = 60000;

const SYSTEM = `You map how a set of research papers relate to each other, for someone building the background of a topic.

For each paper give:
- label: first author and year, like "Mueller 2014", when the text shows them; otherwise a 2-3 word title.
- summary: one or two plain sentences on what it studies and finds.

Then list the relations between papers that the texts show: one paper replicates, extends, builds on, contradicts, uses the method of, reviews, or cites another. For each:
- from, to: paper ids. Read it as "from <label> to", for example from = the replication, to = the original.
- label: the verb phrase, 1-3 words, such as "replicates" or "contradicts".
- why: one sentence on how they connect and what that means for someone combining them.
- quote: a passage copied word for word from the "from" paper that shows the relation. Empty if none.
Judge only from the documents. Leave a relation out rather than guess.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["sources", "relations"],
  properties: {
    sources: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "label", "summary"],
        properties: { id: { type: "string" }, label: { type: "string" }, summary: { type: "string" } },
      },
    },
    relations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["from", "to", "label", "why", "quote"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          label: { type: "string" },
          why: { type: "string" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

let client: Anthropic | null = null;

export async function analyze(body: AnalyzeRequest): Promise<AnalyzeResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "No API key. Add ANTHROPIC_API_KEY to .env.local and restart npm run dev." };
  }
  if (!body.sources?.length) return { error: "Add a paper or a link first." };

  const notes: string[] = [];
  const texts = new Map<string, string>();
  const fetched = new Map<string, string>();
  const titles = new Map<string, string>();
  await Promise.all(
    body.sources.map(async (s) => {
      if (s.text?.trim()) {
        texts.set(s.id, s.text);
      } else if (s.url) {
        const page = await readLink(s.url);
        if (page.error) notes.push(`${s.title}: ${page.error}`);
        if (page.cut) notes.push(`${s.title}: only the first part of the page was read.`);
        texts.set(s.id, page.text);
        if (page.text) fetched.set(s.id, page.text);
        if (page.title) titles.set(s.id, page.title);
      }
    }),
  );

  client ??= new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = body.sources.map((s) => ({
    type: "document",
    title: `id: ${s.id} · ${s.title}`,
    source: { type: "text", media_type: "text/plain", data: texts.get(s.id) || "(No text could be read.)" },
  }));
  content.push({ type: "text", text: `Paper ids: ${body.sources.map((s) => s.id).join(", ")}` });

  try {
    const response = await client.beta.messages.parse({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium", format: jsonSchemaOutputFormat(SCHEMA) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") return { error: "The model declined to analyze these papers." };
    if (response.stop_reason === "max_tokens") return { error: "The analysis ran too long. Try fewer papers." };
    const out = response.parsed_output;
    if (!out) return { error: "The analysis came back in a form the page could not read." };

    const ids = new Set(body.sources.map((s) => s.id));
    const sources: AnalyzedSource[] = out.sources
      .filter((s) => ids.has(s.id))
      .map((s) => ({
        ...s,
        ...(fetched.has(s.id) ? { text: fetched.get(s.id) } : {}),
        ...(titles.has(s.id) ? { pageTitle: titles.get(s.id) } : {}),
      }));
    const relations: AnalyzedRelation[] = out.relations
      .filter((r) => r.from !== r.to && ids.has(r.from) && ids.has(r.to))
      .map((r) => ({ ...r, quoteFound: !!r.quote && contains(texts.get(r.from) ?? "", r.quote) }));
    return { sources, relations, notes };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { error: "The API key was not accepted." };
    if (error instanceof Anthropic.RateLimitError) return { error: "Rate limited. Try again in a minute." };
    if (error instanceof Anthropic.APIError) return { error: `API error ${error.status}: ${error.message}` };
    return { error: "Could not reach the API." };
  }
}

/** Whitespace- and quote-mark-insensitive check that a quote really is in the text. */
function contains(text: string, quote: string) {
  const norm = (s: string) =>
    s
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[‐-—]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  return norm(text).includes(norm(quote));
}

/** A whole paper with its references, for arXiv's full-text pages. Ordinary pages keep LINK_CHARS. */
const PAPER_CHARS = 400000;

type Page = { text: string; title?: string; cut?: boolean; error?: string };

export async function readLink(url: string): Promise<Page> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { text: "", error: "not a valid link." };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { text: "", error: "only http and https links can be read." };
  // An arXiv abstract page has only the abstract. Its HTML version has the whole
  // paper with its references, which is what shows how papers relate.
  const arxiv = /^(?:www\.)?arxiv\.org$/.test(parsed.hostname) && /^\/abs\/([^/?#]+)/.exec(parsed.pathname)?.[1];
  if (arxiv) {
    const full = await readPage(new URL(`https://arxiv.org/html/${arxiv}`), PAPER_CHARS);
    if (full.text) {
      const abs = await readPage(parsed, LINK_CHARS);
      return { ...full, title: abs.title ?? full.title };
    }
  }
  return readPage(parsed, LINK_CHARS);
}

async function readPage(parsed: URL, limit: number): Promise<Page> {
  try {
    const res = await fetch(parsed, { signal: AbortSignal.timeout(15000), headers: { "User-Agent": "source-map-prototype" } });
    if (!res.ok) return { text: "", error: `the page answered ${res.status}.` };
    const type = res.headers.get("content-type") ?? "";
    if (!type.includes("html") && !type.includes("text")) {
      return { text: "", error: "this link is not a web page. Add PDFs with + Paper instead." };
    }
    const html = await res.text();
    const title = htmlToText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "") || undefined;
    const text = htmlToText(html);
    return text.length > limit ? { text: text.slice(0, limit), title, cut: true } : { text, title };
  } catch {
    return { text: "", error: "the page could not be loaded." };
  }
}

function htmlToText(html: string) {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n\n")
    .trim();
}
