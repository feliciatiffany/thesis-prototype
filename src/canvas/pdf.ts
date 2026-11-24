/**
 * Read a PDF in the browser and split it into sections by its numbered
 * headings ("1 Introduction", "3.2 ..."). Stops at References. Rough on
 * purpose: equations and tables come through as plain text or not at all.
 */

type Section = { heading: string; text: string };

const HEADING = /^(\d{1,2}(?:\.\d{1,2}){0,2})\.?\s+([A-Z][^.!?]{2,70})$/;
const NAMED = /^(Abstract|Introduction|Related [Ww]ork|Background|Methods?|Results|Discussion|Conclusions?|Limitations)$/;
const END = /^(References|Bibliography|Acknowledg(e)?ments)$/;

/** `keepReferences` keeps the reference list as a last section, for tools that map how papers cite each other. */
export async function readPdf(
  file: File,
  { keepReferences = false }: { keepReferences?: boolean } = {},
): Promise<{ title: string; sections: Section[] }> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      if (!("str" in item)) continue;
      line += item.str;
      if (item.hasEOL) {
        lines.push(line.trim());
        line = "";
      }
    }
    if (line.trim()) lines.push(line.trim());
  }

  const meta = await doc.getMetadata().catch(() => null);
  const metaTitle = (meta?.info as { Title?: string } | undefined)?.Title?.trim();
  const title = metaTitle || lines.find((l) => l.length > 8) || file.name.replace(/\.pdf$/i, "");

  const sections: Section[] = [];
  let current: Section = { heading: "Title page", text: "" };
  let paragraph = "";
  const typical = median(lines.map((l) => l.length).filter((n) => n > 20)) || 80;

  const flush = () => {
    if (paragraph) current.text += (current.text ? "\n\n" : "") + paragraph;
    paragraph = "";
  };

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    if (!line) continue;
    // "1" on one line and "Introduction" on the next.
    if (/^\d{1,2}(\.\d{1,2}){0,2}$/.test(line) && HEADING.test(`${line} ${lines[i + 1] ?? ""}`)) {
      line = `${line} ${lines[++i]}`;
    }
    if (END.test(line)) {
      if (!keepReferences || !/^(References|Bibliography)$/.test(line)) break;
      flush();
      if (current.text) sections.push(current);
      current = { heading: line, text: lines.slice(i + 1).join(" ") };
      break;
    }
    if (HEADING.test(line) || NAMED.test(line)) {
      flush();
      if (current.text) sections.push(current);
      current = { heading: line, text: "" };
      continue;
    }
    if (/^\d{1,3}$/.test(line)) continue; // page numbers
    paragraph =
      paragraph.endsWith("-") && /^[a-z]/.test(line)
        ? paragraph.slice(0, -1) + line
        : paragraph
          ? `${paragraph} ${line}`
          : line;
    // A short line that ends a sentence usually ends a paragraph.
    if (/[.:?!”"]$/.test(line) && line.length < typical * 0.7) flush();
  }
  flush();
  if (current.text) sections.push(current);

  return { title, sections: sections.length ? sections : [{ heading: "Text", text: lines.join(" ") }] };
}

function median(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}
