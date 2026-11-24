import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { clamp } from "./layout.ts";
import { useMap } from "./store.ts";
import type { MapSource, Message, Relation } from "./types.ts";
import "./map.css";

const nameOf = (s: MapSource) => s.label ?? shorten(s.title);

/**
 * Source map prototype. Left: the papers. Middle: how they relate, analyzed by
 * the AI as soon as a paper is added. Right: ask the AI about the papers and
 * how they connect, or dig into one paper's related research.
 */
export function MapApp() {
  const [draft, setDraft] = useState("");

  useEffect(() => {
    const before = document.title;
    document.title = "Source map";
    return () => {
      document.title = before;
    };
  }, []);

  return (
    <div className="sm">
      <Library />
      <MapPanel onAsk={setDraft} />
      <Chat draft={draft} setDraft={setDraft} />
    </div>
  );
}

/* ---------------- left: papers ---------------- */

function Library() {
  const sources = useMap((s) => s.sources);
  const selected = useMap((s) => s.selected);
  const analyzing = useMap((s) => s.analyzing);
  const error = useMap((s) => s.error);
  const notes = useMap((s) => s.notes);
  const { addPaper, addLink, removeSource, select, loadExample, clear } = useMap.getState();
  const [link, setLink] = useState("");
  const [reading, setReading] = useState("");
  const isExample = sources.some((s) => s.example);

  const onPdf = async (file: File) => {
    setReading(`Reading ${file.name}…`);
    try {
      const { readPdf } = await import("../canvas/pdf.ts");
      const { title, sections } = await readPdf(file, { keepReferences: true });
      addPaper(title, sections.map((s) => `${s.heading}\n\n${s.text}`).join("\n\n"));
      setReading("");
    } catch {
      setReading(`${file.name} could not be read as a PDF.`);
    }
  };

  const onLink = () => {
    const url = link.trim();
    if (!url) return;
    addLink(/^https?:\/\//i.test(url) ? url : `https://${url}`);
    setLink("");
  };

  return (
    <aside className="sm-side" aria-label="Papers">
      <div className="sm-brand">Source map</div>
      <div className="sm-label sm-row">
        <span>Papers</span>
        <span className="sm-count">{sources.length}</span>
      </div>
      <ul className="sm-sources">
        {sources.map((s) => (
          <li key={s.id} className={s.id === selected ? "is-selected" : ""}>
            <button type="button" className="sm-source" onClick={() => select(s.id)}>
              <span className="sm-source-text">
                <span className="sm-source-title">{nameOf(s)}</span>
                <span className="sm-source-kind">
                  {s.example ? "Example · no text" : s.kind === "paper" ? "PDF" : "Link"}
                </span>
              </span>
            </button>
            <button type="button" className="sm-remove" aria-label={`Remove ${nameOf(s)}`} onClick={() => removeSource(s.id)}>
              ×
            </button>
          </li>
        ))}
        {sources.length === 0 ? <li className="sm-empty">Add a paper or a link below.</li> : null}
      </ul>

      <div className="sm-add">
        <label className="sm-btn">
          + Paper (PDF)
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
        <form
          className="sm-link"
          onSubmit={(e) => {
            e.preventDefault();
            onLink();
          }}
        >
          <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a link" aria-label="Link to a paper" />
          <button type="submit" className="sm-btn" disabled={!link.trim()}>
            + Link
          </button>
        </form>
        {reading ? <p className="sm-note">{reading}</p> : null}
        {analyzing ? <p className="sm-note">Analyzing how your papers relate…</p> : null}
        {error ? (
          <p className="sm-note sm-error" role="alert">
            {error}
          </p>
        ) : null}
        {notes.map((n) => (
          <p key={n} className="sm-note">
            {n}
          </p>
        ))}
      </div>

      <div className="sm-foot">
        {isExample ? null : (
          <button type="button" className="sm-text-btn" onClick={loadExample}>
            Load the example
          </button>
        )}
        <button type="button" className="sm-text-btn" onClick={clear}>
          Start empty
        </button>
      </div>
    </aside>
  );
}

/* ---------------- middle: the map ---------------- */

function MapPanel({ onAsk }: { onAsk: (q: string) => void }) {
  const sources = useMap((s) => s.sources);
  const selected = useMap((s) => s.selected);
  const source = sources.find((s) => s.id === selected);
  const isExample = sources.some((s) => s.example);

  return (
    <main className="sm-main" aria-label="How the papers relate">
      <header className="sm-head">
        <span className="sm-head-claim">How your papers relate</span>
      </header>
      <div className={`sm-board${source ? " has-card" : ""}`}>
        <Graph onAsk={onAsk} />
        {source ? <Detail source={source} /> : null}
        {isExample ? (
          <p className="sm-example">Example. The summaries and links were written by hand, not read from the papers.</p>
        ) : null}
      </div>
    </main>
  );
}

function Detail({ source }: { source: MapSource }) {
  const sources = useMap((s) => s.sources);
  const relations = useMap((s) => s.relations);
  const digging = useMap((s) => s.digging);
  const { select, digDown } = useMap.getState();
  const mine = relations.filter((r) => r.from === source.id || r.to === source.id);
  const label = (id: string) => {
    const s = sources.find((x) => x.id === id);
    return s ? nameOf(s) : id;
  };

  return (
    <div className="sm-card">
      <div className="sm-card-top">
        <span className="sm-label sm-flush">{source.kind === "paper" ? "Paper" : "Link"}</span>
        <button type="button" className="sm-text-btn" onClick={() => select(null)}>
          Close
        </button>
      </div>
      <h2 className="sm-card-title">
        {source.url ? (
          <a href={source.url} target="_blank" rel="noreferrer">
            {source.title}
          </a>
        ) : (
          source.title
        )}
      </h2>
      {source.summary ? <p>{source.summary}</p> : <p className="sm-muted">Not analyzed yet.</p>}

      {mine.length ? (
        <ul className="sm-rels">
          {mine.map((r) => (
            <li key={`${r.from}-${r.to}-${r.label}`}>
              <p className="sm-rel-head">
                {label(r.from)} <strong>{r.label}</strong> {label(r.to)}
              </p>
              <p>{r.why}</p>
              {r.quote ? (
                <blockquote className={r.quoteFound ? "" : "is-unchecked"}>
                  “{r.quote}”
                  <span className="sm-quote-check">
                    {r.quoteFound ? `Found word for word in ${label(r.from)}.` : "Not found in the paper text. Check it."}
                  </span>
                </blockquote>
              ) : null}
            </li>
          ))}
        </ul>
      ) : source.summary ? (
        <p className="sm-muted">No link to the other papers was found.</p>
      ) : null}

      <button
        type="button"
        className="sm-btn sm-dig"
        disabled={digging !== null}
        onClick={() => void digDown(source.id)}
        title="Search the web for more research related to this paper. Results show in the chat."
      >
        {digging === source.id ? "Searching…" : "Find related research"}
      </button>
    </div>
  );
}

function Graph({ onAsk }: { onAsk: (q: string) => void }) {
  const sources = useMap((s) => s.sources);
  const relations = useMap((s) => s.relations);
  const positions = useMap((s) => s.positions);
  const selected = useMap((s) => s.selected);
  const { select, move } = useMap.getState();
  const area = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: string; moved: boolean; x: number; y: number } | null>(null);

  const byId = (id: string) => sources.find((s) => s.id === id);
  const lines = relations.filter((r) => byId(r.from) && byId(r.to) && positions[r.from] && positions[r.to]);
  const pct = (v: number) => `${v * 100}%`;
  const lit = (r: Relation) => !selected || r.from === selected || r.to === selected;

  const onDown = (id: string) => (e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id, moved: false, x: e.clientX, y: e.clientY };
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    const box = area.current?.getBoundingClientRect();
    if (!d || !box) return;
    if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 4) return;
    d.moved = true;
    move(d.id, {
      x: clamp((e.clientX - box.left) / box.width, 0.04, 0.96),
      y: clamp((e.clientY - box.top) / box.height, 0.04, 0.96),
    });
  };
  const onUp = (id: string) => () => {
    if (drag.current && !drag.current.moved) select(selected === id ? null : id);
    drag.current = null;
  };

  return (
    <div className="sm-graph" ref={area} onPointerMove={onMove}>
      <svg className="sm-edges" aria-hidden="true">
        <defs>
          <marker id="sm-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0 L10 5 L0 10 z" fill="#111" />
          </marker>
        </defs>
        {lines.map((r) => {
          const a = positions[r.from];
          const b = positions[r.to];
          return (
            <line
              key={`${r.from}-${r.to}-${r.label}`}
              className={lit(r) ? "" : "is-dim"}
              x1={pct(a.x)}
              y1={pct(a.y)}
              x2={pct(a.x + (b.x - a.x) * 0.82)}
              y2={pct(a.y + (b.y - a.y) * 0.82)}
              markerEnd="url(#sm-arrow)"
            />
          );
        })}
      </svg>

      {lines.map((r) => (
        <button
          key={`label-${r.from}-${r.to}-${r.label}`}
          type="button"
          className={`sm-edge-label${lit(r) ? "" : " is-dim"}`}
          style={{
            left: pct((positions[r.from].x + positions[r.to].x) / 2),
            top: pct((positions[r.from].y + positions[r.to].y) / 2),
          }}
          title={`${r.why} Click to ask the AI about this link.`}
          onClick={() => onAsk(`How is ${nameOf(byId(r.from)!)} related to ${nameOf(byId(r.to)!)}?`)}
        >
          {r.label}
        </button>
      ))}

      {sources.map((s) =>
        positions[s.id] ? (
          <button
            key={s.id}
            type="button"
            className={`sm-node${s.text || s.example ? "" : " is-unverified"}${s.id === selected ? " is-selected" : ""}`}
            style={{ left: pct(positions[s.id].x), top: pct(positions[s.id].y) }}
            onPointerDown={onDown(s.id)}
            onPointerUp={onUp(s.id)}
            aria-label={nameOf(s)}
            aria-pressed={s.id === selected}
            title="Click for details. Drag to move."
          >
            {nameOf(s)}
          </button>
        ) : null,
      )}

      {sources.length === 0 ? <p className="sm-graph-empty">Papers you add on the left show up here.</p> : null}
    </div>
  );
}

/* ---------------- right: chat ---------------- */

function Chat({ draft, setDraft }: { draft: string; setDraft: (q: string) => void }) {
  const messages = useMap((s) => s.messages);
  const asking = useMap((s) => s.asking);
  const digging = useMap((s) => s.digging);
  const { ask } = useMap.getState();
  const end = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [messages.length, asking, digging]);

  useEffect(() => {
    if (draft) input.current?.focus();
  }, [draft]);

  const send = () => {
    if (!draft.trim()) return;
    void ask(draft);
    setDraft("");
  };

  return (
    <aside className="sm-chat" aria-label="Ask AI">
      <header className="sm-head">
        <span className="sm-head-claim">Ask AI</span>
      </header>
      <div className="sm-messages" aria-live="polite">
        {messages.length === 0 ? (
          <p className="sm-muted">
            Ask how your papers relate, or how to combine them. Click a link on the map to ask about it.
          </p>
        ) : null}
        {messages.map((m, i) => (
          <MessageView key={i} message={m} />
        ))}
        {asking ? <p className="sm-muted">Reading your papers…</p> : null}
        {digging ? <p className="sm-muted">Searching the web for related research…</p> : null}
        <div ref={end} />
      </div>
      <form
        className="sm-form"
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
          placeholder="Ask about your papers"
          aria-label="Message"
        />
        <button type="submit" className="sm-btn" disabled={!draft.trim() || asking}>
          Send
        </button>
      </form>
    </aside>
  );
}

function MessageView({ message }: { message: Message }) {
  const adding = useMap((s) => s.adding);
  const sources = useMap((s) => s.sources);
  const { addRecommended } = useMap.getState();

  if (message.role === "user") return <p className="sm-user">{message.text}</p>;
  if ("recs" in message) {
    return (
      <div className="sm-assistant">
        <p>{message.text}</p>
        <ul className="sm-recs">
          {message.recs.map((r) => {
            const added = sources.some((s) => s.url === r.url);
            const state = adding[r.url];
            return (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="sm-rec-title">
                  {r.title}
                </a>
                <span className="sm-rec-why">{r.why}</span>
                {added ? (
                  <span className="sm-muted">On your map</span>
                ) : (
                  <button type="button" className="sm-btn" disabled={state === ""} onClick={() => void addRecommended(r)}>
                    {state === "" ? "Adding…" : "+ Add to map"}
                  </button>
                )}
                {state ? <span className="sm-error">{state}</span> : null}
              </li>
            );
          })}
        </ul>
      </div>
    );
  }
  return (
    <div className={`sm-assistant${message.error ? " is-error" : ""}`}>
      <p>{message.text}</p>
      {message.quotes?.length ? (
        message.quotes.map((q) => (
          <blockquote key={q.quote} className="sm-chat-quote">
            “{q.quote}”<span>{q.cite}</span>
          </blockquote>
        ))
      ) : message.error ? null : (
        <p className="sm-muted">No passage was quoted, so this answer is not backed by your papers.</p>
      )}
    </div>
  );
}

function shorten(title: string) {
  if (/^https?:\/\//.test(title)) {
    try {
      return new URL(title).hostname.replace(/^www\./, "");
    } catch {
      // Fall through to the plain cut.
    }
  }
  return title.length > 24 ? `${title.slice(0, 22)}…` : title;
}
