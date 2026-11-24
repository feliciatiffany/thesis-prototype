import type { Point, Relation } from "./types.ts";

/**
 * Place papers that have no position yet with a small spring layout: related
 * papers pull together, all papers push apart. Papers that already have a
 * position (placed by hand, or by the seed) stay where they are.
 * Coordinates run 0 to 1 inside the graph area.
 */
export function layout(ids: string[], relations: Pick<Relation, "from" | "to">[], fixed: Record<string, Point>) {
  const pos: Record<string, Point> = {};
  ids.forEach((id, i) => {
    if (fixed[id]) pos[id] = { ...fixed[id] };
    else {
      // Deterministic start on a ring.
      const a = (2 * Math.PI * i) / Math.max(ids.length, 1) + 0.4;
      pos[id] = { x: 0.5 + 0.32 * Math.cos(a), y: 0.5 + 0.32 * Math.sin(a) };
    }
  });
  const free = ids.filter((id) => !fixed[id]);
  if (free.length === 0) return pos;

  const links = relations.filter((r) => pos[r.from] && pos[r.to]);
  for (let step = 0; step < 300; step++) {
    const force: Record<string, Point> = {};
    for (const id of free) force[id] = { x: 0.02 * (0.5 - pos[id].x), y: 0.02 * (0.5 - pos[id].y) };
    for (const a of free) {
      for (const b of ids) {
        if (a === b) continue;
        const dx = pos[a].x - pos[b].x;
        const dy = pos[a].y - pos[b].y;
        const d2 = Math.max(dx * dx + dy * dy, 0.0004);
        force[a].x += (0.0015 * dx) / d2;
        force[a].y += (0.0015 * dy) / d2;
      }
    }
    for (const r of links) {
      const dx = pos[r.to].x - pos[r.from].x;
      const dy = pos[r.to].y - pos[r.from].y;
      const d = Math.hypot(dx, dy) || 0.001;
      const pull = 0.08 * (d - 0.3);
      if (force[r.from]) {
        force[r.from].x += (pull * dx) / d;
        force[r.from].y += (pull * dy) / d;
      }
      if (force[r.to]) {
        force[r.to].x -= (pull * dx) / d;
        force[r.to].y -= (pull * dy) / d;
      }
    }
    for (const id of free) {
      pos[id].x = clamp(pos[id].x + clamp(force[id].x, -0.03, 0.03), 0.06, 0.94);
      pos[id].y = clamp(pos[id].y + clamp(force[id].y, -0.03, 0.03), 0.06, 0.94);
    }
  }
  return pos;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
