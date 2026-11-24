import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { sentencesOf, VERDICT } from "./content.ts";
import type { Check } from "./content.ts";
import { useTrail } from "./store.ts";
import type { Branch, Message } from "./store.ts";
import "./trail.css";

/**
 * Paper trail prototype.
 * Left: the main doc (your notes) and the library of papers.
 * Middle: your notes. Recheck traces each sentence to a passage in the papers.
 * Right: the assistant. Click a trail to pin that branch on top and ask about it.
 */
export function TrailApp() {
  useEffect(() => {
    const before = document.title;
    document.title = "Paper trail";
    return () => {
      document.title = before;
    };
  }, []);

  return (
    <div className="pt">
      <Library />
      <Notes />
      <Assistant />
    </div>
  );
}

/* ---------------- left: main doc + library ---------------- */

function Library() {
  const papers = useTrail((s) => s.papers);
  const notes = useTrail((s) => s.notes);
  const { addPaper, removePaper, reset } = useTrail.getState();
  const [reading, setReading] = useState("");
  const count = sentencesOf(notes).flat().length;

  const onPdf = async (file: File) => {
    setReading(`Reading ${file.name}…`);
    try {
      const { readPdf } = await import("../canvas/pdf.ts");
      const { title, sections } = await readPdf(file);
      addPaper({ title, sections, note: `PDF · ${sections.length} sections` });
      setReading("");
    } catch {
      setReading(`${file.name} could not be read as a PDF.`);
    }
  };

  return (
    <aside className="pt-library" aria-label="Library">
      <header className="pt-head">Library</header>
      <div className="pt-label">Main doc</div>
      <div className="pt-main-doc">
        <span className="pt-paper-title">My notes</span>
        <span className="pt-paper-meta">You are writing here · {count} sentences</span>
      </div>
      <div className="pt-label">Papers</div>
      <ul className="pt-papers">
        {papers.map((p) => (
          <li key={p.id}>
            <span className="pt-paper">
              {p.url ? (
                <a className="pt-paper-title" href={p.url} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
              ) : (
                <span className="pt-paper-title">{p.title}</span>
              )}
              <span className="pt-paper-meta">{p.example ? "Example · no text" : p.note}</span>
            </span>
            <button type="button" className="pt-remove" aria-label={`Remove ${p.title}`} onClick={() => removePaper(p.id)}>
              ×
            </button>
          </li>
        ))}
        {papers.length === 0 ? <li className="pt-hint pt-pad">No papers yet.</li> : null}
      </ul>
      <label className="pt-btn pt-add">
        + Add paper (PDF)
        <input
          type="file"
          accept="application/pdf"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onPdf(file);
            e.target.value = "";
          }}
        />
      </label>
      {reading ? <p className="pt-hint pt-note">{reading}</p> : null}
      <button type="button" className="pt-text-btn" onClick={reset}>
        Reset to the example
      </button>
    </aside>
  );
}

/* ---------------- middle: notes ---------------- */

function Notes() {
  const notes = useTrail((s) => s.notes);
  const checks = useTrail((s) => s.checks);
  const checking = useTrail((s) => s.checking);
  const checkError = useTrail((s) => s.checkError);
  const { setNotes, recheck } = useTrail.getState();
  const [editing, setEditing] = useState(!notes.trim());
  const unchecked = sentencesOf(notes)
    .flat()
    .filter((s) => !checks[s]).length;

  return (
    <main className="pt-main">
      <header className="pt-head pt-head-row">
        <span className="pt-head-title">My notes</span>
        <span className="pt-status">
          {checkError ? <span className="pt-error">{checkError}</span> : null}
          {!checkError && unchecked ? `${unchecked} sentence${unchecked > 1 ? "s" : ""} not checked yet` : null}
        </span>
        <button type="button" className="pt-btn" onClick={() => setEditing(!editing)}>
          {editing ? "Done" : "Edit"}
        </button>
        <button
          type="button"
          className="pt-btn pt-strong"
          disabled={checking || !notes.trim()}
          onClick={() => {
            setEditing(false);
            void recheck();
          }}
          title="The AI checks each sentence against the papers in your library."
        >
          {checking ? "Rechecking…" : "Recheck"}
        </button>
      </header>
      {editing ? (
        <textarea
          className="pt-editor"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Write your notes here. Recheck traces each sentence to your papers."
          aria-label="My notes"
          autoFocus
        />
      ) : (
        <TrailView />
      )}
    </main>
  );
}

type Seg = { text: string; card?: string; sentence?: string; dotted?: boolean };
type Card = { id: string; check: Check; sentence: string };

/** Lay the notes out sentence by sentence. Each traced phrase ends its line, as in the wireframe. */
function build(notes: string, checks: Record<string, Check>) {
  const segs: Seg[] = [];
  const cards: Card[] = [];
  for (const paragraph of sentencesOf(notes)) {
    for (const sentence of paragraph) {
      const check = checks[sentence];
      if (!check) {
        segs.push({ text: `${sentence} ` });
        continue;
      }
      if (check.verdict === "not_covered") {
        segs.push({ text: sentence, sentence, dotted: true }, { text: " " });
        continue;
      }
      const key = `${check.cite}|${check.quote}`;
      let card = cards.find((c) => c.id === key);
      if (!card) {
        card = { id: key, check, sentence };
        cards.push(card);
      }
      const at = Math.max(0, sentence.indexOf(check.phrase));
      const after = sentence.slice(at + check.phrase.length);
      const punct = /^[,.;:!?)\]”"']+/.exec(after)?.[0] ?? "";
      const rest = after.slice(punct.length).trimStart();
      segs.push({ text: sentence.slice(0, at) }, { text: check.phrase, card: key, sentence }, { text: `${punct}\n` });
      if (rest) segs.push({ text: `${rest} ` });
    }
    segs.push({ text: "\n\n" });
  }
  return { segs, cards };
}

type Layout = {
  marks: { i: number; card: string; x: number; y: number }[];
  tops: Record<string, number>;
  width: number;
  height: number;
};

function TrailView() {
  const notes = useTrail((s) => s.notes);
  const checks = useTrail((s) => s.checks);
  const branch = useTrail((s) => s.branch);
  const { pin } = useTrail.getState();
  const [hover, setHover] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const markEls = useRef(new Map<number, HTMLSpanElement>());
  const cardEls = useRef(new Map<string, HTMLDivElement>());
  const [layout, setLayout] = useState<Layout | null>(null);
  const { segs, cards } = useMemo(() => build(notes, checks), [notes, checks]);
  const pinned = branch ? `${branch.check.cite}|${branch.check.quote}` : null;
  const lit = hover ?? pinned;

  useLayoutEffect(() => {
    const measure = () => {
      const el = box.current;
      if (!el) return;
      const root = el.getBoundingClientRect();
      const marks: Layout["marks"] = [];
      for (const [i, span] of markEls.current) {
        const card = segs[i]?.card;
        const rects = span.getClientRects();
        const last = rects[rects.length - 1];
        if (!card || !last) continue;
        marks.push({ i, card, x: last.right - root.left, y: last.top + last.height / 2 - root.top + el.scrollTop });
      }
      const tops: Record<string, number> = {};
      let floor = 16;
      for (const c of cards) {
        const first = marks.find((m) => m.card === c.id);
        const top = Math.max((first?.y ?? 0) - 14, floor);
        tops[c.id] = top;
        floor = top + (cardEls.current.get(c.id)?.offsetHeight ?? 60) + 12;
      }
      const next = { marks, tops, width: root.width, height: Math.max(el.scrollHeight, floor) };
      setLayout((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (box.current) ro.observe(box.current);
    return () => ro.disconnect();
  }, [segs, cards]);

  const cardLeft = layout ? layout.width - 24 - 236 : 0;
  const state = (id: string) => (lit && lit !== id ? " is-dim" : lit === id ? " is-on" : "");

  return (
    <div className="pt-trail" ref={box}>
      <p className="pt-answer">
        {segs.map((seg, i) => {
          if (seg.dotted && seg.sentence) {
            const sentence = seg.sentence;
            return (
              <span
                key={i}
                className={`pt-uncovered${lit ? " is-dim" : ""}`}
                title="No paper in your library covers this. Click to ask the assistant."
                onClick={() => pin({ sentence, check: checks[sentence] })}
              >
                {seg.text}
              </span>
            );
          }
          if (!seg.card || !seg.sentence) return <span key={i}>{seg.text}</span>;
          const card = seg.card;
          const sentence = seg.sentence;
          const check = checks[sentence];
          return (
            <span
              key={i}
              ref={(el) => {
                if (el) markEls.current.set(i, el);
                else markEls.current.delete(i);
              }}
              className={`pt-mark${state(card)}`}
              style={{ "--c": VERDICT[check.verdict].color } as CSSProperties}
              tabIndex={0}
              onMouseEnter={() => setHover(card)}
              onMouseLeave={() => setHover(null)}
              onClick={() => pin({ sentence, check })}
              onKeyDown={(e) => {
                if (e.key === "Enter") pin({ sentence, check });
              }}
            >
              {seg.text}
            </span>
          );
        })}
      </p>
      <p className="pt-hint pt-tip">
        Hover a highlight to see related passages from your other sources. Click it to ask the assistant.
      </p>

      {layout ? (
        <svg className="pt-lines" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.marks.map((m) => {
            const c = cards.find((x) => x.id === m.card);
            if (!c) return null;
            const ty = layout.tops[m.card] + 22;
            const mid = (m.x + cardLeft) / 2;
            return (
              <g key={m.i} className={state(m.card)} style={{ color: VERDICT[c.check.verdict].color }}>
                <path d={`M ${m.x + 4} ${m.y} C ${mid} ${m.y}, ${mid} ${ty}, ${cardLeft} ${ty}`} />
                <circle cx={m.x + 4} cy={m.y} r={2.5} />
              </g>
            );
          })}
        </svg>
      ) : null}

      {cards.map((c) => (
        <div
          key={c.id}
          ref={(el) => {
            if (el) cardEls.current.set(c.id, el);
            else cardEls.current.delete(c.id);
          }}
          className={`pt-card${state(c.id)}`}
          style={{ top: layout?.tops[c.id] ?? 0, "--c": VERDICT[c.check.verdict].color } as CSSProperties}
          onMouseEnter={() => setHover(c.id)}
          onMouseLeave={() => setHover(null)}
          onClick={() => pin({ sentence: c.sentence, check: c.check })}
        >
          <SourceQuote check={c.check} />
        </div>
      ))}
    </div>
  );
}

function SourceQuote({ check }: { check: Check }) {
  return (
    <>
      <div className="pt-cite">
        <span className="pt-dot" aria-hidden="true" />
        <span className="pt-cite-text">
          {VERDICT[check.verdict].label} · {check.cite}
        </span>
      </div>
      <blockquote>“{check.quote}”</blockquote>
      {check.quoteFound ? null : <p className="pt-unfound">Not found word for word in the paper. Check it.</p>}
    </>
  );
}

/* ---------------- right: assistant ---------------- */

function Assistant() {
  const messages = useTrail((s) => s.messages);
  const branch = useTrail((s) => s.branch);
  const asking = useTrail((s) => s.asking);
  const recommending = useTrail((s) => s.recommending);
  const { ask, pin, recommend } = useTrail.getState();
  const [draft, setDraft] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, asking, recommending]);

  useEffect(() => {
    if (branch) input.current?.focus();
  }, [branch]);

  const send = () => {
    if (!draft.trim()) return;
    void ask(draft);
    setDraft("");
  };

  return (
    <aside className="pt-chat" aria-label="Assistant">
      <header className="pt-head pt-head-row">
        <span className="pt-head-title">Assistant</span>
        <button type="button" className="pt-btn" disabled={recommending} onClick={() => void recommend()}>
          {recommending ? "Searching…" : "Recommend papers"}
        </button>
      </header>

      {branch ? (
        <div className="pt-branch">
          <div className="pt-branch-top">
            <span className="pt-label pt-flush">Asking about</span>
            <button type="button" className="pt-remove pt-show" aria-label="Stop asking about this" onClick={() => pin(null)}>
              ×
            </button>
          </div>
          <BranchView branch={branch} />
        </div>
      ) : null}

      <div className="pt-messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="pt-hint">
            Ask about your papers, click a highlight in your notes to ask about it, or get related papers with Recommend
            papers.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <MessageView key={i} message={m} />
        ))}
        {asking ? <p className="pt-hint">Reading your papers…</p> : null}
        {recommending ? <p className="pt-hint">Searching the web for related papers…</p> : null}
        <div ref={end} />
      </div>

      <form
        className="pt-form"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <textarea
          ref={input}
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={branch ? "Ask about this sentence" : "Ask about your papers"}
          aria-label="Message"
        />
        <button type="submit" className="pt-btn" disabled={!draft.trim() || asking}>
          Send
        </button>
      </form>
    </aside>
  );
}

function BranchView({ branch }: { branch: Branch }) {
  const { sentence, check } = branch;
  const at = sentence.indexOf(check.phrase);
  return (
    <div className="pt-branch-body" style={{ "--c": VERDICT[check.verdict].color } as CSSProperties}>
      <p className="pt-branch-sentence">
        {at >= 0 && check.verdict !== "not_covered" ? (
          <>
            {sentence.slice(0, at)}
            <span className="pt-mark is-quiet">{check.phrase}</span>
            {sentence.slice(at + check.phrase.length)}
          </>
        ) : (
          sentence
        )}
      </p>
      {check.verdict === "not_covered" ? (
        <p className="pt-hint">No paper in your library covers this.</p>
      ) : (
        <div className="pt-branch-quote">
          <SourceQuote check={check} />
        </div>
      )}
    </div>
  );
}

function MessageView({ message }: { message: Message }) {
  const adding = useTrail((s) => s.adding);
  const papers = useTrail((s) => s.papers);
  const { addRecommended } = useTrail.getState();

  if (message.role === "user") {
    return (
      <div className="pt-user-wrap">
        {message.branch ? <p className="pt-about">About: “{message.branch.check.phrase}”</p> : null}
        <p className="pt-user">{message.text}</p>
      </div>
    );
  }
  if ("recs" in message) {
    return (
      <div className="pt-assistant">
        <p>{message.text}</p>
        <ul className="pt-recs">
          {message.recs.map((r) => {
            const added = papers.some((p) => p.url === r.url);
            const state = adding[r.url];
            return (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="pt-rec-title">
                  {r.title}
                </a>
                <span className="pt-rec-why">{r.why}</span>
                {added ? (
                  <span className="pt-hint">In your library</span>
                ) : (
                  <button
                    type="button"
                    className="pt-btn pt-rec-add"
                    disabled={state === ""}
                    onClick={() => void addRecommended(r)}
                  >
                    {state === "" ? "Adding…" : "+ Add to library"}
                  </button>
                )}
                {state ? <span className="pt-error">{state}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div className={`pt-assistant${message.error ? " is-error" : ""}`}>
      <p>{message.text}</p>
      {message.quotes?.length ? (
        message.quotes.map((q) => (
          <blockquote key={q.quote} className="pt-chat-quote">
            “{q.quote}”<span className="pt-cite-text">{q.cite}</span>
          </blockquote>
        ))
      ) : message.error ? null : (
        <p className="pt-hint">No passage was quoted, so this answer is not backed by your papers.</p>
      )}
    </div>
  );
}
