import Anthropic from "@anthropic-ai/sdk";
import { jsonSchemaOutputFormat } from "@anthropic-ai/sdk/helpers/json-schema";
import { readLink } from "./analyze.ts";

/**
 * Paper trail endpoints, dev server only so the API key never reaches the browser.
 * - recheck: check each sentence of the user's notes against the library papers.
 * - recommend: search the web for real papers related to the notes.
 * - read: read a recommended paper's page so it can join the library.
 */

export type TrailDoc = { title: string; text: string };
export type Verdict = "supported" | "contested" | "not_covered";

export type RecheckRequest = { sentences: string[]; docs: TrailDoc[] };
export type SentenceCheck = {
  index: number;
  verdict: Verdict;
  /** The words in the sentence the check is about. Always a substring of the sentence. */
  phrase: string;
  /** Index into docs, or -1 when no paper covers the sentence. */
  doc: number;
  quote: string;
  /** True when the quote was found word for word in that document. */
  quoteFound: boolean;
};
export type RecheckResponse = { checks: SentenceCheck[] } | { error: string };

export type Recommendation = { title: string; url: string; why: string };
export type RecommendRequest = { notes: string; library: string[] };
export type RecommendResponse = { papers: Recommendation[] } | { error: string };

export type ReadRequest = { url: string };
export type ReadResponse = { title: string; text: string; cut: boolean } | { error: string };

const MODEL = "claude-opus-5-5";
let client: Anthropic | null = null;
const noKey = () => !process.env.ANTHROPIC_API_KEY;
const NO_KEY = "No API key. Add ANTHROPIC_API_KEY to .env.local and restart npm run dev.";

function apiError(error: unknown): { error: string } {
  if (error instanceof Anthropic.AuthenticationError) return { error: "The API key was not accepted." };
  if (error instanceof Anthropic.RateLimitError) return { error: "Rate limited. Try again in a minute." };
  if (error instanceof Anthropic.APIError) return { error: `API error ${error.status}: ${error.message}` };
  return { error: "Could not reach the API." };
}

/* ---------------- recheck ---------------- */

const RECHECK_SYSTEM = `You check someone's research notes against the papers they collected, sentence by sentence.

For every numbered sentence, decide:
- "supported": a passage in the papers backs it.
- "contested": a passage in the papers says otherwise or sharply limits it.
- "not_covered": no passage speaks to it, or the sentence makes no factual claim.
Judge only from the documents. Do not use outside knowledge.

For each sentence also give:
- phrase: the 2-6 words in the sentence that carry the claim, copied exactly from the sentence.
- doc: the index of the document with the passage (as listed), or -1 for not_covered.
- quote: the passage copied word for word from that document, one or two sentences. Empty for not_covered.
Return one result per sentence.`;

const RECHECK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["results"],
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["index", "verdict", "phrase", "doc", "quote"],
        properties: {
          index: { type: "integer" },
          verdict: { type: "string", enum: ["supported", "contested", "not_covered"] },
          phrase: { type: "string" },
          doc: { type: "integer" },
          quote: { type: "string" },
        },
      },
    },
  },
} as const;

export async function recheck(body: RecheckRequest): Promise<RecheckResponse> {
  if (noKey()) return { error: NO_KEY };
  const docs = (body.docs ?? []).filter((d) => d.text?.trim());
  if (!body.sentences?.length) return { error: "Write some notes first." };
  if (docs.length === 0) return { error: "Add a paper to the library first. The example papers have no text." };
  client ??= new Anthropic();

  const content: Anthropic.Beta.BetaContentBlockParam[] = docs.map((d, i) => ({
    type: "document",
    title: `[${i}] ${d.title}`,
    source: { type: "text", media_type: "text/plain", data: d.text },
    // The papers stay the same between rechecks, so cache them.
    ...(i === docs.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
  content.push({
    type: "text",
    text: `Documents are numbered 0 to ${docs.length - 1}.\n\nSentences:\n${body.sentences.map((s, i) => `${i}. ${s}`).join("\n")}`,
  });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: jsonSchemaOutputFormat(RECHECK_SCHEMA) },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: RECHECK_SYSTEM,
      messages: [{ role: "user", content }],
    });
    if (response.stop_reason === "refusal") return { error: "The model declined to check these notes." };
    if (response.stop_reason === "max_tokens") return { error: "The check ran too long. Try shorter notes." };
    const out = response.parsed_output;
    if (!out) return { error: "The check came back in a form the page could not read." };

    const checks: SentenceCheck[] = [];
    for (const r of out.results) {
      const sentence = body.sentences[r.index];
      if (sentence === undefined || checks.some((c) => c.index === r.index)) continue;
      const doc = r.verdict === "not_covered" || r.doc < 0 || r.doc >= docs.length ? -1 : r.doc;
      checks.push({
        index: r.index,
        verdict: doc === -1 ? "not_covered" : (r.verdict as Verdict),
        phrase: r.phrase && sentence.includes(r.phrase) ? r.phrase : sentence.trim(),
        doc,
        quote: doc === -1 ? "" : r.quote,
        quoteFound: doc !== -1 && !!r.quote && contains(docs[doc].text, r.quote),
      });
    }
    return { checks };
  } catch (error) {
    return apiError(error);
  }
}

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

/* ---------------- recommend ---------------- */

const RECOMMEND_SYSTEM = `You recommend research papers related to someone's notes.

Search the web for real, published papers (journal articles, conference papers, preprints) that would help them check or extend their notes, especially papers that test the same claims or disagree with them. Skip papers already in their library.

Prefer links to open pages that show the paper's text or abstract, such as arXiv abstract pages, PubMed, ACL Anthology or open-access journals, so the paper can be added to the library.

When done, call recommend_papers once with up to 5 papers. Use only papers you found in search results, with the URL exactly as it appeared there. For each, "why" is one short sentence on how it relates to the notes.`;

const RECOMMEND_TOOL: Anthropic.Beta.BetaTool = {
  name: "recommend_papers",
  description: "Give the final list of recommended papers. Call once, at the end.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["papers"],
    properties: {
      papers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "url", "why"],
          properties: { title: { type: "string" }, url: { type: "string" }, why: { type: "string" } },
        },
      },
    },
  },
};

export async function recommend(body: RecommendRequest): Promise<RecommendResponse> {
  if (noKey()) return { error: NO_KEY };
  if (!body.notes?.trim()) return { error: "Write some notes first, so there is something to match." };
  client ??= new Anthropic();

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: "user",
      content: `My notes:\n${body.notes.trim()}\n\nAlready in my library:\n${body.library.length ? body.library.join("\n") : "(nothing yet)"}`,
    },
  ];
  const found = new Set<string>();

  try {
    // Web search runs on the server and can pause a long turn; continue it a few times.
    for (let round = 0; round < 4; round++) {
      const response = await client.beta.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: "medium" },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: RECOMMEND_SYSTEM,
        // The basic search tool on purpose: its results come back readable, so every
        // recommended link can be checked against what the search really returned.
        // (The newer tool filters results inside encrypted code execution.)
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 5 }, RECOMMEND_TOOL],
        messages,
      });
      if (response.stop_reason === "refusal") return { error: "The model declined to search for this." };

      for (const block of response.content) {
        if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const r of block.content) if (r.type === "web_search_result") found.add(r.url);
        }
      }
      const pick = response.content.find((b) => b.type === "tool_use" && b.name === "recommend_papers");
      if (pick && pick.type === "tool_use") {
        const papers = ((pick.input as { papers?: Recommendation[] }).papers ?? [])
          // Only papers that really came up in the search: no links from memory.
          .filter((p) => found.has(p.url))
          .slice(0, 5);
        return papers.length ? { papers } : { error: "The search found no papers it could link to. Try again." };
      }
      if (response.stop_reason !== "pause_turn") break;
      messages.push({ role: "assistant", content: response.content });
    }
    return { error: "The search did not finish with a list. Try again." };
  } catch (error) {
    return apiError(error);
  }
}

/* ---------------- read ---------------- */

export async function read(body: ReadRequest): Promise<ReadResponse> {
  const page = await readLink(body.url ?? "");
  if (page.error) return { error: `Could not read the page: ${page.error}` };
  if (!page.text) return { error: "The page had no text to read." };
  return { title: page.title ?? body.url, text: page.text, cut: !!page.cut };
}
