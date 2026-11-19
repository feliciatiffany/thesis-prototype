import { IconCheck, IconInfo, IconQuestion, IconWarning } from "./Icons.tsx";
import type { Quadrant } from "../types.ts";

export function QuadrantIcon({ quadrant }: { quadrant: Quadrant }) {
  if (quadrant === "confidently_wrong") return <IconWarning />;
  if (quadrant === "speculation") return <IconQuestion />;
  if (quadrant === "unstable_sourced") return <IconInfo />;
  return <IconCheck />;
}
