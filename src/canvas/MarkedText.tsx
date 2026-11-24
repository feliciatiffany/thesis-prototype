import { Fragment } from "react";
import type { ReactNode } from "react";
import type { Frame } from "./types.ts";

/**
 * A frame's text with its marks underlined. The text nodes inside add up to
 * exactly `frame.text`, so a selection can be turned back into offsets.
 * Marks may overlap: the text is cut at every mark edge and each piece is
 * wrapped once per mark that covers it.
 */
export function MarkedText({ frame }: { frame: Frame }) {
  const { text, marks } = frame;
  const cuts = [...new Set([0, text.length, ...marks.flatMap((m) => [m.start, m.end])])]
    .filter((n) => n >= 0 && n <= text.length)
    .sort((a, b) => a - b);

  const pieces: ReactNode[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const start = cuts[i];
    const end = cuts[i + 1];
    let piece: ReactNode = text.slice(start, end);
    for (const mark of marks) {
      if (mark.start <= start && mark.end >= end) {
        piece = (
          <span data-mark={mark.id} className={`dc-mark dc-mark-${mark.kind}`}>
            {piece}
          </span>
        );
      }
    }
    pieces.push(<Fragment key={start}>{piece}</Fragment>);
  }

  return (
    <div className="dc-text" data-text-of={frame.id} data-nodrag>
      {pieces}
    </div>
  );
}
