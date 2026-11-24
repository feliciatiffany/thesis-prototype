import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MarkedText } from "./MarkedText.tsx";
import { saveFile, useSrc } from "./media.ts";
import { useCanvas } from "./store.ts";
import type { Frame } from "./types.ts";

type Props = {
  frame: Frame;
  picked: boolean;
  editing: boolean;
};

/** A text box that grows with what is typed in it. */
function Area(props: { value: string; placeholder: string; rows: number; onChange(value: string): void }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [props.value]);
  return (
    <textarea
      ref={ref}
      className="dc-input dc-area"
      data-nodrag
      rows={props.rows}
      value={props.value}
      placeholder={props.placeholder}
      onChange={(e) => props.onChange(e.target.value)}
    />
  );
}

function linkHref(src: string) {
  return /^[a-z][a-z0-9+.-]*:/i.test(src) || src.startsWith("/") ? src : `https://${src}`;
}

function linkHost(src: string) {
  try {
    return new URL(linkHref(src)).hostname.replace(/^www\./, "");
  } catch {
    return src;
  }
}

/** An image, a video or a link, shown as that thing. Empty until one is added. */
function Media({ frame, editing }: { frame: Frame; editing: boolean }) {
  const url = useSrc(frame.src);
  const patch = useCanvas.getState().patchFrame;
  const name = frame.kind === "image" ? "Image" : frame.kind === "video" ? "Video" : "Link";

  let shown = <div className="dc-blank">{name}</div>;
  if (frame.kind === "image" && url) {
    shown = <img className="dc-media" src={url} alt={frame.title} draggable={false} />;
  } else if (frame.kind === "video" && url) {
    shown = <video className="dc-media" data-nodrag src={url} controls />;
  } else if (frame.kind === "link" && frame.src) {
    shown = (
      <a className="dc-linkcard" data-nodrag href={linkHref(frame.src)} target="_blank" rel="noreferrer">
        <b>{linkHost(frame.src)}</b>
        <span>{frame.src}</span>
      </a>
    );
  }

  return (
    <>
      {shown}
      {editing ? (
        <div className="dc-form" data-nodrag>
          {frame.kind === "link" ? null : (
            <label className="dc-btn">
              Choose a file
              <input
                type="file"
                hidden
                accept={`${frame.kind}/*`}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) patch(frame.id, { src: await saveFile(file), title: file.name });
                }}
              />
            </label>
          )}
          <input
            className="dc-input"
            placeholder={frame.kind === "link" ? "Paste a link" : "or paste its address"}
            value={frame.src.startsWith("file:") ? "" : frame.src}
            onChange={(e) => patch(frame.id, { src: e.target.value.trim(), title: "" })}
          />
        </div>
      ) : null}
    </>
  );
}

/** Choose a PDF: its sections become the canvas inside this paper. */
function PdfPicker({ frame }: { frame: Frame }) {
  const [status, setStatus] = useState("");
  return (
    <div className="dc-form" data-nodrag>
      <label className="dc-btn">
        Choose a PDF
        <input
          type="file"
          hidden
          accept="application/pdf"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setStatus("Reading…");
            try {
              const { readPdf } = await import("./pdf.ts");
              const { title, sections } = await readPdf(file);
              useCanvas.getState().fillPaper(frame.id, frame.title || title, sections);
              setStatus(`${sections.length} sections inside. Zoom in to read.`);
            } catch {
              setStatus("Could not read that PDF.");
            }
          }}
        />
      </label>
      {status ? <div className="dc-hint">{status}</div> : null}
    </div>
  );
}

/** On a question: what it continues from, so a thread of questions stays readable. */
function FollowsFrom({ id }: { id: string }) {
  const from = useCanvas((s) => {
    const board = s.boards[s.boardId];
    const edge = board?.edges.find((e) => e.to === id && e.kind === "branch");
    const origin = board?.frames.find((f) => f.id === edge?.from);
    if (!origin) return "";
    const words = (origin.title || origin.text).replace(/\s+/g, " ").trim();
    return words.length > 60 ? `${words.slice(0, 58)}…` : words;
  });
  return from ? <div className="dc-hint dc-follows">Continues from: {from}</div> : null;
}

/** The answer part of a question frame. */
function Answer({ frame, editing, text }: { frame: Frame; editing: boolean; text: ReactNode }) {
  const status = useCanvas((s) => s.asking[frame.id]);
  const askAI = useCanvas((s) => s.askAI);
  const waiting = status === "";
  return (
    <>
      <div className="dc-label">Answer</div>
      {waiting ? <div className="dc-hint">Reading the paper…</div> : text}
      {status ? <div className="dc-error">{status}</div> : null}
      {!editing && frame.title.trim() ? (
        <div data-nodrag>
          <button className="dc-btn" disabled={waiting} onClick={() => askAI(frame.id)}>
            {frame.text ? "Answer again" : "Get answer"}
          </button>
        </div>
      ) : null}
    </>
  );
}

export const FrameView = memo(function FrameView({ frame, picked, editing }: Props) {
  const { patchFrame, setText } = useCanvas.getState();
  const set = (patch: Partial<Frame>) => patchFrame(frame.id, patch);
  const isMedia = frame.kind === "image" || frame.kind === "video" || frame.kind === "link";
  /** A closed box: zooming in opens the canvas inside, like a TouchDesigner Component. */
  const closed = Boolean(frame.inside);

  // When editing starts, put the cursor in the first box so typing works straight away.
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!editing) return;
    el.current
      ?.querySelector<HTMLElement>("input:not([type=file]), textarea")
      ?.focus({ preventScroll: true });
  }, [editing]);

  /** The frame's main text: a box to type in, the underlined text, or a grey hint when empty. */
  const text = (whenEmpty: string, whenTyping: string, rows: number) => {
    if (editing) {
      return (
        <Area
          value={frame.text}
          placeholder={whenTyping}
          rows={rows}
          onChange={(value) => setText(frame.id, value)}
        />
      );
    }
    return frame.text ? <MarkedText frame={frame} /> : <div className="dc-hint">{whenEmpty}</div>;
  };

  let body;
  if (frame.kind === "paper") {
    const title = frame.title || "Untitled paper";
    if (closed) {
      // Outside: only the title. The reading lives on the canvas inside.
      body = (
        <>
          <div className="dc-label">Paper</div>
          {editing ? (
            <input
              className="dc-input dc-title"
              data-nodrag
              value={frame.title}
              placeholder="Title"
              onChange={(e) => set({ title: e.target.value })}
            />
          ) : (
            <div className="dc-title">{title}</div>
          )}
          {editing ? <PdfPicker frame={frame} /> : <div className="dc-hint">Zoom in to open</div>}
        </>
      );
    } else {
      body = (
        <>
          <div className="dc-label">Paper</div>
          {editing ? (
            <input
              className="dc-input dc-title"
              data-nodrag
              value={frame.title}
              placeholder="Title"
              onChange={(e) => set({ title: e.target.value })}
            />
          ) : (
            <div className="dc-title">{title}</div>
          )}
          {text("No text yet. Press Edit to paste it in.", "Paste the text of the paper here", 12)}
        </>
      );
    }
  } else if (frame.kind === "doc") {
    // Your own writing. Draw a line from it to a paper to compare them.
    body = (
      <>
        <div className="dc-label">My doc</div>
        {editing ? (
          <input
            className="dc-input dc-title"
            data-nodrag
            value={frame.title}
            placeholder="Title"
            onChange={(e) => set({ title: e.target.value })}
          />
        ) : (
          <div className="dc-title">{frame.title || "Untitled doc"}</div>
        )}
        {text("Empty. Press Edit to write.", "Write your notes here", 8)}
      </>
    );
  } else if (frame.kind === "card") {
    body = (
      <>
        {editing ? (
          <input
            className="dc-input"
            data-nodrag
            value={frame.title}
            placeholder="Label"
            onChange={(e) => set({ title: e.target.value })}
          />
        ) : frame.title ? (
          <div className="dc-label">{frame.title}</div>
        ) : null}
        {text("Empty", "Text", 2)}
      </>
    );
  } else if (frame.kind === "sticky") {
    body = text("Empty note", "Type a note", 3);
  } else if (frame.kind === "question") {
    body = (
      <>
        <div className="dc-heading">Question</div>
        <FollowsFrom id={frame.id} />
        {frame.quote ? <div className="dc-quote">“{frame.quote}”</div> : null}
        {editing ? (
          <Area
            value={frame.title}
            placeholder="Type your question"
            rows={2}
            onChange={(title) => set({ title })}
          />
        ) : frame.title ? (
          <div>{frame.title}</div>
        ) : (
          <div className="dc-hint">No question yet</div>
        )}
        <Answer
          frame={frame}
          editing={editing}
          text={text("Not answered yet.", "Or type an answer by hand", 3)}
        />
      </>
    );
  } else {
    body = <Media frame={frame} editing={editing} />;
  }

  const classes = ["dc-frame", `dc-${frame.kind}`];
  if (picked) classes.push("is-picked");
  if (closed) classes.push("is-closed");

  return (
    <div
      ref={el}
      data-frame={frame.id}
      data-inside={frame.inside || undefined}
      className={classes.join(" ")}
      style={{
        left: frame.x,
        top: frame.y,
        width: frame.w,
        ...(closed || (isMedia && !editing) ? { height: frame.h } : { minHeight: frame.h }),
      }}
    >
      {body}
      {picked ? <div data-resize className="dc-resize" /> : null}
    </div>
  );
});
