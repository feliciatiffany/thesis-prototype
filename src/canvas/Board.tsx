import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent, Ref } from "react";
import { Edges } from "./Edges.tsx";
import { FrameView } from "./FrameView.tsx";
import { saveFile } from "./media.ts";
import { DEFAULT_SIZE } from "./seed.ts";
import { nameOf, useCanvas } from "./store.ts";
import type { Board, Edge, FrameKind, Lens, MarkBox, Rect } from "./types.ts";

/** A board opens zoomed out no further in than this, so it starts as an overview. */
const OPEN_ZOOM = 0.75;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;
/**
 * How much of the view a closed frame must fill before the next zoom-in
 * enters its canvas (TouchDesigner: keep zooming in to go inside).
 */
const ENTER_FILL = 0.82;
/** Zooming out past this while inside a frame goes up one level. */
const EXIT_ZOOM = 0.4;

type View = { x: number; y: number; k: number };
type Picked = { type: "frame" | "edge"; id: string };
type Span = { start: number; end: number };
/** Words a person has selected in a frame, and where to float the menu for them. */
type Words = Span & { frameId: string; text: string; x: number; y: number };
type Gesture =
  | { kind: "pan" | "move" | "resize"; id: string; px: number; py: number; ox: number; oy: number }
  /** Pointer is down on a frame; becomes `move` after a few pixels so double-click can still fire. */
  | { kind: "pending"; id: string; px: number; py: number; ox: number; oy: number };
const DRAG_THRESHOLD = 4;
type Size = { w: number; h: number };
type Geometry = { sizes: Record<string, Size>; marks: Record<string, MarkBox[]> };

/** Places to try for a new frame: a 40px grid around a point, nearest first. */
const NEARBY = (() => {
  const steps: [number, number][] = [];
  for (let i = -25; i <= 25; i++) for (let j = -25; j <= 25; j++) steps.push([i * 40, j * 40]);
  return steps.sort((a, b) => a[0] ** 2 + a[1] ** 2 - (b[0] ** 2 + b[1] ** 2));
})();

const ADD: [FrameKind, string][] = [
  ["paper", "Paper"],
  ["doc", "Doc"],
  ["sticky", "Sticky note"],
  ["image", "Image"],
  ["video", "Video"],
  ["link", "Link"],
];

const clamp = (n: number, low: number, high: number) => Math.min(high, Math.max(low, n));

/** How many characters of `root`'s text come before a point in it. */
function textOffset(root: Node, node: Node, offset: number) {
  const range = document.createRange();
  range.selectNodeContents(root);
  range.setEnd(node, offset);
  return range.toString().length;
}

export type BoardHandle = { zoomTo(frameId: string): void };

export function BoardView({ board, ref }: { board: Board; ref?: Ref<BoardHandle> }) {
  const path = useCanvas((s) => s.path);
  const boards = useCanvas((s) => s.boards);
  const { addFrame, patchFrame, removeFrame, removeEdge, link, enter, up, goTo } = useCanvas.getState();

  const boardRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const measured = useRef("");
  const opened = useRef(false);
  const viewRef = useRef<View>({ x: 0, y: 0, k: 1 });
  const rectsRef = useRef<Record<string, Rect>>({});

  const [view, setView] = useState<View>({ x: 0, y: 0, k: 1 });
  const [geometry, setGeometry] = useState<Geometry>({ sizes: {}, marks: {} });
  const [picked, setPicked] = useState<Picked | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [words, setWords] = useState<Words | null>(null);
  const [connecting, setConnecting] = useState<{ from: string; words: Span | null } | null>(null);
  const [panning, setPanning] = useState(false);
  /** A line being dragged out of a frame's handle, in board pixels. */
  const [wire, setWire] = useState<{ from: string; x0: number; y0: number; x: number; y: number } | null>(null);

  /** Where every frame sits on the board, using its real height once it has been drawn. */
  const rects = useMemo(() => {
    const out: Record<string, Rect> = {};
    for (const f of board.frames) {
      const size = geometry.sizes[f.id];
      out[f.id] = { x: f.x, y: f.y, w: size?.w ?? f.w, h: size?.h ?? f.h };
    }
    return out;
  }, [board.frames, geometry.sizes]);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    rectsRef.current = rects;
  }, [rects]);
  const hidden = useMemo(() => new Set<string>(), []);

  /* ---------- zoom and pan ---------- */

  const fit = useCallback((targets: Rect[], maxZoom: number) => {
    const el = boardRef.current;
    if (!el || targets.length === 0) return;
    const x0 = Math.min(...targets.map((r) => r.x));
    const y0 = Math.min(...targets.map((r) => r.y));
    const x1 = Math.max(...targets.map((r) => r.x + r.w));
    const y1 = Math.max(...targets.map((r) => r.y + r.h));
    const k = clamp(
      Math.min((el.clientWidth - 120) / (x1 - x0), (el.clientHeight - 120) / (y1 - y0)),
      MIN_ZOOM,
      maxZoom,
    );
    setView({ k, x: (el.clientWidth - (x0 + x1) * k) / 2, y: (el.clientHeight - (y0 + y1) * k) / 2 });
    setWords(null);
  }, []);

  /** Which closed frame (if any) is under a point in the board's pixel space. */
  const closedAt = useCallback(
    (cx: number, cy: number, v: View) => {
      const wx = (cx - v.x) / v.k;
      const wy = (cy - v.y) / v.k;
      return board.frames.find((f) => {
        if (!f.inside) return false;
        const r = rectsRef.current[f.id];
        return r && wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
      });
    },
    [board.frames],
  );

  /**
   * Zoom toward a point. If you keep zooming into a closed frame, enter its
   * canvas. If you keep zooming out while inside one, go up a level.
   * Same idea as TouchDesigner's roller-wheel network navigation.
   */
  const zoomAt = useCallback(
    (cx: number, cy: number, factor: number) => {
      const el = boardRef.current;
      if (!el) return;
      const v = viewRef.current;
      setWords(null);

      if (factor < 1) {
        const next = v.k * factor;
        if (next < EXIT_ZOOM && useCanvas.getState().path.length > 1) {
          up();
          return;
        }
      }

      if (factor > 1) {
        const target = closedAt(cx, cy, v);
        if (target) {
          const r = rectsRef.current[target.id];
          if (r) {
            const nextK = Math.min(MAX_ZOOM, v.k * factor);
            const fills =
              (r.w * nextK) / el.clientWidth >= ENTER_FILL || (r.h * nextK) / el.clientHeight >= ENTER_FILL;
            if (fills && enter(target.id)) return;
          }
        }
      }

      setView((cur) => {
        const k = clamp(cur.k * factor, MIN_ZOOM, MAX_ZOOM);
        const scale = k / cur.k;
        return { k, x: cx - (cx - cur.x) * scale, y: cy - (cy - cur.y) * scale };
      });
    },
    [closedAt, enter, up],
  );

  const zoomStep = (factor: number) => {
    const el = boardRef.current;
    if (el) zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
  };

  const enterFrame = useCallback(
    (frameId: string) => {
      if (enter(frameId)) return true;
      return false;
    },
    [enter],
  );

  /** Move the view only if `rect` is not fully on screen. */
  const reveal = (rect: Rect) => {
    const el = boardRef.current;
    if (!el) return;
    setView((v) => {
      const onScreen =
        v.x + rect.x * v.k >= 0 &&
        v.y + rect.y * v.k >= 0 &&
        v.x + (rect.x + rect.w) * v.k <= el.clientWidth &&
        v.y + (rect.y + rect.h) * v.k <= el.clientHeight;
      if (onScreen) return v;
      return {
        ...v,
        x: el.clientWidth / 2 - (rect.x + rect.w / 2) * v.k,
        y: el.clientHeight / 2 - (rect.y + rect.h / 2) * v.k,
      };
    });
  };

  // A board opens showing everything on it.
  useLayoutEffect(() => {
    if (opened.current) return;
    opened.current = true;
    fit(Object.values(rects), OPEN_ZOOM);
  }, [fit, rects]);

  // The wheel zooms toward the pointer. Keep zooming into a closed frame to enter it;
  // keep zooming out to leave (TouchDesigner Network Editor).
  useEffect(() => {
    const el = boardRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const box = el.getBoundingClientRect();
      const delta = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
      zoomAt(e.clientX - box.left, e.clientY - box.top, Math.exp(-delta * (e.ctrlKey ? 0.01 : 0.002)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /** Zoom in on one frame, or enter it if it holds another canvas. */
  const zoomInto = useCallback(
    (frameId: string) => {
      const frame = board.frames.find((f) => f.id === frameId);
      if (frame?.inside) {
        enterFrame(frameId);
        return;
      }
      const sources = board.edges.filter((e) => e.from === frameId && e.kind === "source").map((e) => e.to);
      const targets = [frameId, ...sources].flatMap((id) => (rects[id] ? [rects[id]] : []));
      fit(targets, 1.5);
    },
    [board.frames, board.edges, rects, fit, enterFrame],
  );

  // Clicking a file in the folder list zooms in on it, or enters it.
  useImperativeHandle(
    ref,
    () => ({
      zoomTo(frameId: string) {
        zoomInto(frameId);
        setPicked({ type: "frame", id: frameId });
      },
    }),
    [zoomInto],
  );

  /* ---------- measuring ---------- */

  // Read how tall each frame came out and where each underline sits, so lines can
  // start at the exact words. Board units, so zooming alone does not change them.
  useLayoutEffect(() => {
    const world = worldRef.current;
    if (!world) return;
    const origin = world.getBoundingClientRect();
    const sizes: Geometry["sizes"] = {};
    const marks: Geometry["marks"] = {};
    world.querySelectorAll<HTMLElement>("[data-frame]").forEach((el) => {
      sizes[el.dataset.frame ?? ""] = { w: el.offsetWidth, h: el.offsetHeight };
    });
    world.querySelectorAll<HTMLElement>("[data-mark]").forEach((el) => {
      const boxes = (marks[el.dataset.mark ?? ""] ??= []);
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight);
      for (const box of el.getClientRects()) {
        const h = box.height / view.k;
        boxes.push({
          x: Math.round((box.left - origin.left) / view.k),
          y: Math.round((box.top - origin.top) / view.k),
          w: Math.round(box.width / view.k),
          h: Math.round(h),
          gap: Math.round(Math.max(4, (lineHeight || h * 1.4) - h)),
        });
      }
    });
    const key = JSON.stringify([sizes, marks]);
    if (key !== measured.current) {
      measured.current = key;
      setGeometry({ sizes, marks });
    }
  }, [board.frames, view.k, editing]);

  /* ---------- selecting words ---------- */

  useEffect(() => {
    const read = () => {
      const selection = window.getSelection();
      const el = boardRef.current;
      if (!el || !selection || selection.isCollapsed || selection.rangeCount === 0) return setWords(null);
      const range = selection.getRangeAt(0);
      const startNode = range.startContainer;
      const startEl = startNode instanceof Element ? startNode : startNode.parentElement;
      const root = startEl?.closest<HTMLElement>("[data-text-of]");
      if (!root || !el.contains(root)) return setWords(null);

      const full = root.textContent ?? "";
      let start = textOffset(root, range.startContainer, range.startOffset);
      let end = root.contains(range.endContainer)
        ? textOffset(root, range.endContainer, range.endOffset)
        : full.length;
      while (start < end && /\s/.test(full[start])) start++;
      while (end > start && /\s/.test(full[end - 1])) end--;
      if (start >= end) return setWords(null);

      const box = range.getBoundingClientRect();
      const base = el.getBoundingClientRect();
      setWords({
        frameId: root.dataset.textOf ?? "",
        start,
        end,
        text: full.slice(start, end),
        x: box.left + box.width / 2 - base.left,
        y: box.top - base.top,
      });
    };
    // Wait until the mouse is released, so the menu does not chase the selection.
    const onRelease = () => window.setTimeout(read, 0);
    const onChange = () => {
      if (window.getSelection()?.isCollapsed) setWords(null);
    };
    document.addEventListener("pointerup", onRelease);
    document.addEventListener("selectionchange", onChange);
    return () => {
      document.removeEventListener("pointerup", onRelease);
      document.removeEventListener("selectionchange", onChange);
    };
  }, []);

  /* ---------- actions ---------- */

  const clearWords = () => {
    window.getSelection()?.removeAllRanges();
    setWords(null);
  };

  /** The empty spot nearest to (x, y) that fits a frame of this size. */
  const freeSpot = (x: number, y: number, size: Size) => {
    const taken = Object.values(rects);
    const step = NEARBY.find(([dx, dy]) =>
      taken.every(
        (r) =>
          x + dx >= r.x + r.w + 20 ||
          x + dx + size.w + 20 <= r.x ||
          y + dy >= r.y + r.h + 20 ||
          y + dy + size.h + 20 <= r.y,
      ),
    );
    return step ? { x: x + step[0], y: y + step[1] } : { x, y };
  };

  // A new frame goes in the middle of the view, or the nearest empty spot to it.
  const add = (kind: FrameKind) => {
    const el = boardRef.current;
    if (!el) return;
    const size = DEFAULT_SIZE[kind];
    const spot = freeSpot(
      Math.round((el.clientWidth / 2 - view.x) / view.k - size.w / 2),
      Math.round((el.clientHeight / 2 - view.y) / view.k - size.h / 2),
      size,
    );
    const id = addFrame(kind, spot.x, spot.y);
    setPicked({ type: "frame", id });
    setEditing(id);
    reveal({ ...spot, ...size });
  };

  /** Branch a new question out of a frame, or out of specific words in it. */
  const ask = (from: string, about: (Span & { text: string }) | null) => {
    const origin = rects[from];
    if (!origin) return;
    const size = DEFAULT_SIZE.question;
    const x = origin.x + origin.w + 100;
    let y = origin.y;
    const blocked = () =>
      Object.values(rects).some(
        (r) => x < r.x + r.w + 20 && x + size.w + 20 > r.x && y < r.y + r.h + 20 && y + size.h + 20 > r.y,
      );
    while (blocked()) y += 30;

    const id = addFrame("question", x, y, { quote: about?.text ?? "" });
    link("branch", from, about ? { start: about.start, end: about.end } : null, id);
    setPicked({ type: "frame", id });
    setEditing(id);
    clearWords();
    reveal({ x, y, ...size });
  };

  /**
   * A line drawn to nowhere asks the AI: a new question appears where the line
   * ends, continuing the thread of the frame it came from.
   */
  const askAt = (from: string, words: Span | null, wx: number, wy: number) => {
    const size = DEFAULT_SIZE.question;
    const id = addFrame("question", Math.round(wx), Math.round(wy - size.h / 2));
    link("branch", from, words, id);
    setPicked({ type: "frame", id });
    setEditing(id);
    clearWords();
  };

  /** Board pixels to board units. */
  const toWorld = (bx: number, by: number) => ({ x: (bx - view.x) / view.k, y: (by - view.y) / view.k });

  const startConnecting = (from: string, span: Span | null) => {
    setConnecting({ from, words: span });
    clearWords();
  };

  // i / Enter: go inside a closed frame. u: go up. Delete: remove a selected line.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof Element && e.target.closest("input, textarea");
      if (typing) return;
      if (e.key === "Escape") {
        setConnecting(null);
        setEditing(null);
      } else if ((e.key === "i" || e.key === "Enter") && picked?.type === "frame") {
        if (enterFrame(picked.id)) e.preventDefault();
      } else if (e.key === "u") {
        if (up()) e.preventDefault();
      } else if ((e.key === "Backspace" || e.key === "Delete") && picked?.type === "edge") {
        removeEdge(picked.id);
        setPicked(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picked, removeEdge, enterFrame, up]);

  /* ---------- pointer ---------- */

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !(e.target instanceof Element) || e.target.closest("[data-ui]")) return;
    const id = e.target.closest<HTMLElement>("[data-frame]")?.dataset.frame ?? "";

    if (connecting) {
      if (id && id !== connecting.from) link("connect", connecting.from, connecting.words, id);
      else if (!id) {
        // Empty space: the line goes nowhere, so it asks the AI.
        const base = e.currentTarget.getBoundingClientRect();
        const at = toWorld(e.clientX - base.left, e.clientY - base.top);
        askAt(connecting.from, connecting.words, at.x, at.y);
      }
      setConnecting(null);
      return;
    }

    if (editing && editing !== id) setEditing(null);
    setPicked(id ? { type: "frame", id } : null);
    // Text, inputs, links and video keep the click for themselves.
    if (id && e.target.closest("[data-nodrag]")) return;

    const frame = board.frames.find((f) => f.id === id);
    const start = { px: e.clientX, py: e.clientY };
    if (!frame) {
      gesture.current = { kind: "pan", id: "", ...start, ox: view.x, oy: view.y };
      setPanning(true);
      clearWords();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      e.currentTarget.setPointerCapture(e.pointerId);
    } else if (e.target.closest("[data-resize]")) {
      gesture.current = { kind: "resize", id, ...start, ox: frame.w, oy: rects[id]?.h ?? frame.h };
      e.currentTarget.setPointerCapture(e.pointerId);
    } else {
      // Pending until the pointer moves: keeps double-click free to enter a closed frame.
      gesture.current = { kind: "pending", id, ...start, ox: frame.x, oy: frame.y };
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.px;
    const dy = e.clientY - g.py;
    if (g.kind === "pending") {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      gesture.current = { ...g, kind: "move" };
      e.currentTarget.setPointerCapture(e.pointerId);
      patchFrame(g.id, { x: Math.round(g.ox + dx / view.k), y: Math.round(g.oy + dy / view.k) });
      return;
    }
    if (g.kind === "pan") {
      setView((v) => ({ ...v, x: g.ox + dx, y: g.oy + dy }));
    } else if (g.kind === "move") {
      patchFrame(g.id, { x: Math.round(g.ox + dx / view.k), y: Math.round(g.oy + dy / view.k) });
    } else {
      patchFrame(g.id, {
        w: Math.max(120, Math.round(g.ox + dx / view.k)),
        h: Math.max(60, Math.round(g.oy + dy / view.k)),
      });
    }
  };

  const onPointerUp = () => {
    gesture.current = null;
    setPanning(false);
  };

  // Double-click a closed frame to enter its canvas (TouchDesigner Enter Component).
  const onDoubleClick = (e: MouseEvent) => {
    const el = e.target instanceof Element ? e.target.closest<HTMLElement>("[data-inside]") : null;
    if (el?.dataset.frame) enterFrame(el.dataset.frame);
  };

  // Files and links dropped on the board become frames where they land.
  const onDrop = async (e: DragEvent) => {
    e.preventDefault();
    const el = boardRef.current;
    if (!el) return;
    const base = el.getBoundingClientRect();
    const x = Math.round((e.clientX - base.left - view.x) / view.k);
    const y = Math.round((e.clientY - base.top - view.y) / view.k);
    const files = Array.from(e.dataTransfer.files);
    const address = e.dataTransfer.getData("text/uri-list");
    if (files.length === 0 && address) addFrame("link", x, y, { src: address });
    let n = 0;
    for (const file of files) {
      const kind = file.type.startsWith("image/") ? "image" : file.type.startsWith("video/") ? "video" : null;
      if (!kind) continue;
      addFrame(kind, x + n * 30, y + n * 30, { src: await saveFile(file), title: file.name });
      n++;
    }
  };

  /* ---------- draw ---------- */

  const pickedFrame = picked?.type === "frame" ? board.frames.find((f) => f.id === picked.id) : undefined;
  const pickedEdge = picked?.type === "edge" ? board.edges.find((e) => e.id === picked.id) : undefined;
  const pickedRect = pickedFrame ? rects[pickedFrame.id] : undefined;
  const worldStyle = {
    transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
    "--k": view.k,
  } as CSSProperties;

  const pathLabel = (step: (typeof path)[number], index: number) => {
    if (index === 0) return boards[step.boardId]?.name || board.name;
    const parent = boards[path[index - 1].boardId];
    const frame = parent?.frames.find((f) => f.id === step.frameId);
    return frame?.title || boards[step.boardId]?.name || "Inside";
  };

  return (
    <main className="dc-main">
      <header className="dc-head">
        <nav className="dc-path" aria-label="Where you are">
          {path.map((step, index) => (
            <span key={`${step.boardId}-${index}`} className="dc-path-step">
              {index > 0 ? <span className="dc-path-sep">/</span> : null}
              <button
                type="button"
                className={index === path.length - 1 ? "is-here" : undefined}
                onClick={() => goTo(index)}
              >
                {pathLabel(step, index)}
              </button>
            </span>
          ))}
        </nav>
        {path.length > 1 ? (
          <button className="dc-btn" onClick={() => up()} title="Go up (u)">
            Up
          </button>
        ) : null}
        {ADD.map(([kind, label]) => (
          <button key={kind} className="dc-btn" onClick={() => add(kind)}>
            + {label}
          </button>
        ))}
      </header>

      <div
        ref={boardRef}
        className={`dc-board${panning ? " is-panning" : ""}${connecting ? " is-connecting" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={onDoubleClick}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop}
      >
        <div ref={worldRef} className="dc-world" style={worldStyle}>
          {board.frames.map((frame) => (
            <FrameView
              key={frame.id}
              frame={frame}
              picked={picked?.type === "frame" && picked.id === frame.id}
              editing={editing === frame.id}
            />
          ))}
          <Edges
            edges={board.edges}
            rects={rects}
            marks={geometry.marks}
            hidden={hidden}
            zoom={view.k}
            picked={picked?.type === "edge" ? picked.id : null}
            onPick={(id) => setPicked({ type: "edge", id })}
          />
        </div>

        {pickedFrame && pickedRect ? (
          <div
            data-ui
            className="dc-bar"
            style={{
              left: view.x + pickedRect.x * view.k,
              top: Math.max(4, view.y + pickedRect.y * view.k - 38),
            }}
          >
            {pickedFrame.inside ? (
              <button onClick={() => enterFrame(pickedFrame.id)}>Open</button>
            ) : null}
            <button onClick={() => setEditing(editing === pickedFrame.id ? null : pickedFrame.id)}>
              {editing === pickedFrame.id ? "Done" : "Edit"}
            </button>
            <button onClick={() => ask(pickedFrame.id, null)}>
              {pickedFrame.kind === "question" ? "Ask again" : "Ask"}
            </button>
            <button onClick={() => startConnecting(pickedFrame.id, null)}>Connect</button>
            <button
              onClick={() => {
                removeFrame(pickedFrame.id);
                setPicked(null);
              }}
            >
              Delete
            </button>
          </div>
        ) : null}

        {pickedFrame && pickedRect && !editing ? (
          <div
            data-ui
            className="dc-handle"
            title="Drag to a frame to connect, or to empty space to ask the AI"
            style={{
              left: view.x + (pickedRect.x + pickedRect.w) * view.k,
              top: view.y + (pickedRect.y + pickedRect.h / 2) * view.k,
            }}
            onPointerDown={(e) => {
              e.stopPropagation();
              e.currentTarget.setPointerCapture(e.pointerId);
              const base = boardRef.current!.getBoundingClientRect();
              const x = e.clientX - base.left;
              const y = e.clientY - base.top;
              setWire({ from: pickedFrame.id, x0: x, y0: y, x, y });
            }}
            onPointerMove={(e) => {
              if (!wire) return;
              const base = boardRef.current!.getBoundingClientRect();
              setWire({ ...wire, x: e.clientX - base.left, y: e.clientY - base.top });
            }}
            onPointerUp={(e) => {
              if (!wire) return;
              const target = document
                .elementsFromPoint(e.clientX, e.clientY)
                .map((el) => el.closest<HTMLElement>("[data-frame]")?.dataset.frame)
                .find((id) => id && id !== wire.from);
              if (target) {
                link("connect", wire.from, null, target);
                const made = useCanvas.getState().boards[board.id]?.edges.find(
                  (x) => x.kind === "connect" && x.from === wire.from && x.to === target && !x.mark,
                );
                if (made) setPicked({ type: "edge", id: made.id });
              } else if (Math.hypot(wire.x - wire.x0, wire.y - wire.y0) > 24) {
                const at = toWorld(wire.x, wire.y);
                askAt(wire.from, null, at.x, at.y);
              }
              setWire(null);
            }}
          />
        ) : null}

        {wire ? (
          <svg className="dc-wire" aria-hidden="true">
            <line x1={wire.x0} y1={wire.y0} x2={wire.x} y2={wire.y} />
            <circle cx={wire.x} cy={wire.y} r={4} />
          </svg>
        ) : null}

        {pickedEdge?.kind === "connect" && rects[pickedEdge.from] && rects[pickedEdge.to] ? (
          <LineMenu
            key={pickedEdge.id}
            edge={pickedEdge}
            board={board}
            left={view.x + ((rects[pickedEdge.from].x + rects[pickedEdge.from].w / 2 + rects[pickedEdge.to].x + rects[pickedEdge.to].w / 2) / 2) * view.k}
            top={view.y + ((rects[pickedEdge.from].y + rects[pickedEdge.from].h / 2 + rects[pickedEdge.to].y + rects[pickedEdge.to].h / 2) / 2) * view.k}
            onRemove={() => {
              removeEdge(pickedEdge.id);
              setPicked(null);
            }}
          />
        ) : null}

        {words ? (
          <div
            data-ui
            className="dc-bar dc-words"
            style={{ left: words.x, top: words.y }}
            // Keep the words selected while a button here is pressed.
            onPointerDown={(e) => e.preventDefault()}
            onMouseDown={(e) => e.preventDefault()}
          >
            <button onClick={() => ask(words.frameId, words)}>Ask about these words</button>
            <button onClick={() => startConnecting(words.frameId, { start: words.start, end: words.end })}>
              Connect
            </button>
          </div>
        ) : null}

        {connecting ? (
          <div className="dc-banner">Click a frame to connect to, or empty space to ask the AI there. Esc cancels.</div>
        ) : picked?.type === "edge" && pickedEdge?.kind !== "connect" ? (
          <div className="dc-banner">Line selected. Press Delete to remove it.</div>
        ) : null}

        <div data-ui className="dc-zoom">
          <button aria-label="Zoom out" onClick={() => zoomStep(1 / 1.25)}>
            −
          </button>
          <span>{Math.round(view.k * 100)}%</span>
          <button aria-label="Zoom in" onClick={() => zoomStep(1.25)}>
            +
          </button>
          <button onClick={() => fit(Object.values(rects), 1)}>Fit</button>
        </div>
      </div>
    </main>
  );
}

const LENSES: [Lens, string][] = [
  ["connection", "See connection"],
  ["summary", "Summary"],
  ["difference", "See difference"],
];

/** The drop-down on a line someone drew: what the AI reads across its two ends. */
function LineMenu({
  edge,
  board,
  left,
  top,
  onRemove,
}: {
  edge: Edge;
  board: Board;
  left: number;
  top: number;
  onRemove(): void;
}) {
  const looking = useCanvas((s) => s.looking);
  const { lookAcross } = useCanvas.getState();
  const [lens, setLens] = useState<Lens | null>(null);
  const name = (id: string) => {
    const f = board.frames.find((x) => x.id === id);
    return f ? nameOf(f) : "";
  };
  const result = lens ? edge.lenses?.[lens] : undefined;
  const status = lens ? looking[`${edge.id}:${lens}`] : undefined;

  return (
    <div data-ui className="dc-linemenu" style={{ left, top }}>
      <div className="dc-linemenu-ends">
        <span>{name(edge.from)}</span>
        <span className="dc-path-sep">→</span>
        <span>{name(edge.to)}</span>
      </div>
      <div className="dc-linemenu-tabs">
        {LENSES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={lens === key ? "is-on" : undefined}
            onClick={() => {
              setLens(key);
              if (!edge.lenses?.[key]) void lookAcross(edge.id, key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {status === "" ? <div className="dc-hint">Reading both…</div> : null}
      {status ? <div className="dc-error">{status}</div> : null}
      {result ? (
        <div className="dc-linemenu-body">
          <p>{result.answer}</p>
          {result.quotes.length ? (
            result.quotes.map((q) => (
              <div key={q.quote} className="dc-quote">
                “{q.quote}”<span className="dc-linemenu-cite">{q.cite}</span>
              </div>
            ))
          ) : (
            <div className="dc-hint">Nothing was quoted, so this is not backed by either text.</div>
          )}
          <button type="button" className="dc-linemenu-again" onClick={() => void lookAcross(edge.id, lens!)}>
            Read again
          </button>
        </div>
      ) : null}
      <div className="dc-linemenu-foot">
        <button type="button" onClick={onRemove}>
          Remove line
        </button>
      </div>
    </div>
  );
}
