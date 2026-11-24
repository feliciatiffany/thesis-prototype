import Anthropic from "@anthropic-ai/sdk";

/**
 * Answers a question about the papers on a board. Runs on the dev server only,
 * so the API key never reaches the browser.
 *
 * Each section of a paper goes in as its own document with citations on. The
 * answer comes back as text plus, for each cited run of it, the exact passage
 * and which document it came from. The canvas turns those into underlines and
 * source cards.
 */

export type AskDoc = { title: string; text: string };
export type AskRequest = { question: string; quote: string; context: string; docs: AskDoc[] };
export type AskCitation = { start: number; end: number; doc: number; quote: string };
export type AskResponse = { answer: string; citations: AskCitation[] } | { error: string };

const SYSTEM = `You answer questions about the academic papers given as documents, for someone reading them on a canvas.

Answer in 2 to 4 plain sentences. No headings, lists or markdown.
Base every claim on the documents and cite the passages you rely on.
If the documents do not answer the question, say so in one sentence instead of guessing.`;

let client: Anthropic | null = null;

export async function ask(body: AskRequest): Promise<AskResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { error: "No API key. Add ANTHROPIC_API_KEY to .env.local and restart npm run dev." };
  }
  const docs = body.docs.filter((d) => d.text.trim());
  if (!body.question.trim()) return { error: "Type a question first." };
  if (docs.length === 0) return { error: "There is no paper text on this board to answer from." };

  client ??= new Anthropic();

  const prompt = [
    body.context ? `Asked from this note on the canvas:\n${body.context}` : "",
    body.quote ? `About these words in the paper: “${body.quote}”` : "",
    `Question: ${body.question.trim()}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const content: Anthropic.Beta.BetaContentBlockParam[] = docs.map((doc, i) => ({
    type: "document",
    title: doc.title,
    source: { type: "text", media_type: "text/plain", data: doc.text },
    citations: { enabled: true },
    // The papers stay the same from question to question, so cache them.
    ...(i === docs.length - 1 ? { cache_control: { type: "ephemeral" as const } } : {}),
  }));
  content.push({ type: "text", text: prompt });

  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: SYSTEM,
      messages: [{ role: "user", content }],
    });

    if (response.stop_reason === "refusal") {
      return { error: "The model declined to answer this one." };
    }

    let answer = "";
    const citations: AskCitation[] = [];
    for (const block of response.content) {
      if (block.type !== "text") continue;
      const start = answer.length;
      answer += block.text;
      for (const c of block.citations ?? []) {
        if (c.type !== "char_location") continue;
        // Underline the words, not the spaces around them.
        const lead = block.text.length - block.text.trimStart().length;
        const tail = block.text.length - block.text.trimEnd().length;
        if (block.text.trim()) {
          citations.push({
            start: start + lead,
            end: answer.length - tail,
            doc: c.document_index,
            quote: c.cited_text.trim(),
          });
        }
      }
    }
    return { answer: answer.trim() ? answer : "No answer came back.", citations };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { error: "The API key was not accepted." };
    if (error instanceof Anthropic.RateLimitError) return { error: "Rate limited. Try again in a minute." };
    if (error instanceof Anthropic.APIError) return { error: `API error ${error.status}: ${error.message}` };
    return { error: "Could not reach the API." };
  }
}
