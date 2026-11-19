import { useMemo, useState } from "react";
import type { Quadrant } from "../types.ts";

const QUADRANTS: Quadrant[] = [
  "solid",
  "confidently_wrong",
  "speculation",
  "unstable_sourced",
];

interface ClaimRow {
  condition: string;
  quadrant: string;
  human_fever_correct: boolean;
  is_planted_error: boolean;
}

export function AdminScreen() {
  const [rows, setRows] = useState<ClaimRow[]>([]);
  const [notes, setNotes] = useState<string[]>([]);

  async function takeFiles(files: FileList | File[]) {
    const nextNotes: string[] = [];
    const nextRows: ClaimRow[] = [];
    for (const file of Array.from(files)) {
      try {
        const parsed: unknown = JSON.parse(await file.text());
        const found = extractClaims(parsed);
        if (found.length === 0) {
          nextNotes.push(`${file.name}: no claim summaries found. Use the JSON from “Download my data”.`);
        } else {
          nextNotes.push(`${file.name}: ${found.length} claims.`);
          nextRows.push(...found);
        }
      } catch {
        nextNotes.push(`${file.name}: could not read this as JSON.`);
      }
    }
    setNotes(nextNotes);
    setRows(nextRows);
  }

  const conditions = useMemo(() => {
    const found = new Set(rows.map((row) => row.condition));
    const preferred = ["A", "B", "C", "D", "pilot"].filter((item) => found.has(item));
    const extras = [...found].filter((item) => !preferred.includes(item)).sort();
    return [...preferred, ...extras];
  }, [rows]);

  return (
    <div className="min-h-screen bg-[#f4f1ec] px-8 py-12">
      <div className="mx-auto max-w-5xl">
        <p className="text-sm font-medium text-stone-600">Two Kinds of Doubt</p>
        <h1 className="mt-2 text-3xl font-medium text-stone-950">Session files</h1>
        <p className="mt-4 max-w-3xl text-stone-800">
          Drop the JSON files from the end screen. The table shows the share of claims where the
          action and the cited evidence were both acceptable (<span className="font-medium">human_fever_correct</span>
          ), by condition and quadrant.
        </p>
        <label className="mt-6 block rounded-md border border-dashed border-stone-400 bg-white px-4 py-8 text-center">
          <span className="font-medium text-stone-900">Choose JSON files</span>
          <input
            type="file"
            accept="application/json,.json"
            multiple
            className="mt-3 block w-full text-sm"
            onChange={(event) => {
              if (event.target.files) void takeFiles(event.target.files);
            }}
          />
        </label>
        <div
          className="mt-3 rounded-md border border-stone-300 bg-white px-4 py-3 text-sm text-stone-700"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            void takeFiles(event.dataTransfer.files);
          }}
        >
          Or drop files here.
        </div>
        {notes.length > 0 ? (
          <ul className="mt-4 list-disc pl-5 text-sm text-stone-700">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        ) : null}
        <RateTable title="All claims" rows={rows} conditions={conditions} plantedOnly={false} />
        <RateTable title="Planted errors only" rows={rows} conditions={conditions} plantedOnly />
      </div>
    </div>
  );
}

function RateTable({
  title,
  rows,
  conditions,
  plantedOnly,
}: {
  title: string;
  rows: ClaimRow[];
  conditions: string[];
  plantedOnly: boolean;
}) {
  const scoped = plantedOnly ? rows.filter((row) => row.is_planted_error) : rows;
  return (
    <section className="mt-8">
      <h2 className="text-xl font-medium text-stone-950">{title}</h2>
      {scoped.length === 0 ? (
        <p className="mt-2 text-stone-700">No rows yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-stone-300">
                <th className="px-3 py-2 font-medium">Condition</th>
                {QUADRANTS.map((quadrant) => (
                  <th key={quadrant} className="px-3 py-2 font-medium">
                    {quadrant}
                  </th>
                ))}
                <th className="px-3 py-2 font-medium">All</th>
              </tr>
            </thead>
            <tbody>
              {conditions.map((condition) => (
                <tr key={condition} className="border-b border-stone-200">
                  <th className="px-3 py-2 font-medium">{condition}</th>
                  {QUADRANTS.map((quadrant) => (
                    <td key={quadrant} className="px-3 py-2">
                      {rate(
                        scoped.filter(
                          (row) => row.condition === condition && row.quadrant === quadrant,
                        ),
                      )}
                    </td>
                  ))}
                  <td className="px-3 py-2">
                    {rate(scoped.filter((row) => row.condition === condition))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function rate(rows: ClaimRow[]): string {
  if (rows.length === 0) return "—";
  const correct = rows.filter((row) => row.human_fever_correct).length;
  const pct = Math.round((100 * correct) / rows.length);
  return `${pct}% (${correct}/${rows.length})`;
}

function extractClaims(data: unknown): ClaimRow[] {
  if (Array.isArray(data)) return data.flatMap(extractClaims);
  if (!data || typeof data !== "object") return [];
  if ("claims" in data && Array.isArray(data.claims)) {
    return data.claims.filter(isClaimRow);
  }
  if (isClaimRow(data)) return [data];
  return [];
}

function isClaimRow(value: unknown): value is ClaimRow {
  if (!value || typeof value !== "object") return false;
  const row = value as Partial<ClaimRow>;
  return (
    typeof row.condition === "string" &&
    typeof row.quadrant === "string" &&
    typeof row.human_fever_correct === "boolean"
  );
}
