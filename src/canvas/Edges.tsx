import type { Edge, MarkBox, Rect } from "./types.ts";

type Props = {
  edges: Edge[];
  rects: Record<string, Rect>;
  /** Where each underlined run of words sits on the board, one box per line of text. */
  marks: Record<string, MarkBox[]>;
  /** Frames whose text is hidden right now (a paper seen from far away). */
  hidden: Set<string>;
  zoom: number;
  picked: string | null;
  onPick(id: string): void;
};

type Point = { x: number; y: number };

/** Line width on screen, in pixels. Every line looks the same and keeps its width at every zoom. */
const WIDTH = 1.5;

function route(edge: Edge, { rects, marks, hidden }: Props): { path: string; start: Point } | null {
  const from = rects[edge.from];
  const to = rects[edge.to];
  if (!from || !to) return null;

  const words = edge.mark ? marks[edge.mark] : undefined;
  let a: Point;
  let b: Point;
  let start: Point | null = null;
  let lead = "";
  let sideways = true;

  if (words?.length) {
    // Starts at the words. Of the lines they wrap over, use the one nearest the target's side.
    const right = to.x + to.w / 2 >= from.x + from.w / 2;
    const box = words.reduce((best, w) => ((right ? w.x + w.w > best.x + best.w : w.x < best.x) ? w : best));
    const edgeX = right ? from.x + from.w : from.x;
    if (hidden.has(edge.from)) {
      // The text is hidden: start on the frame's edge, level with where the words are.
      a = { x: edgeX, y: box.y + box.h / 2 };
    } else {
      // Step down from the end of the underline into the empty lane between two lines
      // of text, and run along it to the frame's edge. The line never crosses a word.
      const wordX = right ? box.x + box.w : box.x;
      const underline = box.y + box.h;
      const lane = underline + box.gap / 2;
      start = { x: wordX, y: underline };
      lead = `M${wordX},${underline} L${wordX},${lane} L${edgeX},${lane} `;
      a = { x: edgeX, y: lane };
    }
    b = { x: right ? to.x : to.x + to.w, y: to.y + to.h / 2 };
  } else {
    sideways = to.x >= from.x + from.w || to.x + to.w <= from.x;
    if (sideways) {
      const right = to.x >= from.x + from.w;
      a = { x: right ? from.x + from.w : from.x, y: from.y + from.h / 2 };
      b = { x: right ? to.x : to.x + to.w, y: to.y + to.h / 2 };
    } else {
      const down = to.y + to.h / 2 >= from.y + from.h / 2;
      a = { x: from.x + from.w / 2, y: down ? from.y + from.h : from.y };
      b = { x: to.x + to.w / 2, y: down ? to.y : to.y + to.h };
    }
  }

  const gap = sideways ? b.x - a.x : b.y - a.y;
  const bend = Math.max(24, Math.abs(gap) / 2) * (gap < 0 ? -1 : 1);
  const curve = sideways
    ? `C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`
    : `C${a.x},${a.y + bend} ${b.x},${b.y - bend} ${b.x},${b.y}`;
  return { path: `${lead || `M${a.x},${a.y} `}${curve}`, start: start ?? a };
}

export function Edges(props: Props) {
  const { edges, zoom, picked, onPick } = props;
  return (
    <svg className="dc-edges">
      {edges.map((edge) => {
        const line = route(edge, props);
        if (!line) return null;
        const width = (WIDTH + (picked === edge.id ? 1.5 : 0)) / zoom;
        return (
          <g key={edge.id} className={`dc-edge dc-edge-${edge.kind}${picked === edge.id ? " is-picked" : ""}`}>
            <path
              className="dc-edge-hit"
              d={line.path}
              strokeWidth={14 / zoom}
              onPointerDown={(e) => {
                e.stopPropagation();
                onPick(edge.id);
              }}
            />
            <path
              className="dc-edge-line"
              d={line.path}
              strokeWidth={width}
            />
          </g>
        );
      })}
    </svg>
  );
}
