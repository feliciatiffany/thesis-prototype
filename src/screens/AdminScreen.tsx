import { useState } from "react";
import { Link } from "react-router-dom";

interface ScenarioRow {
  condition?: string;
  decision_correct?: boolean | string;
  human_fever_correct?: boolean | string;
}

interface BeliefRow {
  condition?: string;
  quadrant?: string;
  belief_correct?: boolean | string;
}

function isTrue(value: unknown): boolean {
  return value === true || value === "true";
}

function rate(rows: unknown[], pick: (row: unknown) => boolean): string {
  if (rows.length === 0) return "—";
  const hits = rows.filter(pick).length;
  return `${hits}/${rows.length} (${Math.round((100 * hits) / rows.length)}%)`;
}

function readFiles(files: FileList | File[]): Promise<unknown[]> {
  return Promise.all(
    [...files].map(
      (file) =>
        new Promise<unknown>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            try {
              resolve(JSON.parse(String(reader.result)));
            } catch {
              resolve(null);
            }
          };
          reader.readAsText(file);
        }),
    ),
  );
}

export function AdminScreen() {
  const [scenarios, setScenarios] = useState<ScenarioRow[]>([]);
  const [beliefs, setBeliefs] = useState<BeliefRow[]>([]);
  const [note, setNote] = useState("Drop exported events.json files here.");

  const ingest = async (files: FileList | File[]) => {
    const parsed = await readFiles(files);
    const nextScenarios: ScenarioRow[] = [];
    const nextBeliefs: BeliefRow[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== "object") continue;
      const record = item as { scenarios?: ScenarioRow[]; beliefs?: BeliefRow[] };
      if (Array.isArray(record.scenarios)) nextScenarios.push(...record.scenarios);
      if (Array.isArray(record.beliefs)) nextBeliefs.push(...record.beliefs);
    }
    setScenarios(nextScenarios);
    setBeliefs(nextBeliefs);
    setNote(`${nextScenarios.length} scenario rows, ${nextBeliefs.length} belief rows.`);
  };

  const conditions = [
    ...new Set([
      ...scenarios.map((row) => row.condition ?? ""),
      ...beliefs.map((row) => row.condition ?? ""),
    ].filter(Boolean)),
  ];
  const quadrants = [...new Set(beliefs.map((row) => row.quadrant ?? "").filter(Boolean))];

  return (
    <main className="mx-auto max-w-4xl px-4 py-8">
      <p className="text-sm">
        <Link to="/" className="underline">
          Back to the study
        </Link>
      </p>
      <h1 className="mt-3 text-2xl font-medium">Session files</h1>
      <p className="mt-2 text-sm text-stone-600">{note}</p>
      <label
        className="mt-4 block rounded-2xl border border-dashed border-stone-400 p-6 text-sm"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length > 0) void ingest(event.dataTransfer.files);
        }}
      >
        Drop JSON files, or choose them
        <input
          type="file"
          accept="application/json,.json"
          multiple
          className="mt-3 block"
          onChange={(event) => {
            if (event.target.files && event.target.files.length > 0) void ingest(event.target.files);
          }}
        />
      </label>
      <h2 className="mt-8 text-lg font-medium">By condition</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-300">
              <th className="py-2 pr-3 font-medium">Condition</th>
              <th className="py-2 pr-3 font-medium">Scenarios</th>
              <th className="py-2 pr-3 font-medium">Decision correct</th>
              <th className="py-2 pr-3 font-medium">Human FEVER correct</th>
              <th className="py-2 pr-3 font-medium">Belief correct</th>
            </tr>
          </thead>
          <tbody>
            {conditions.length === 0 ? (
              <tr>
                <td className="py-2" colSpan={5}>
                  —
                </td>
              </tr>
            ) : (
              conditions.map((condition) => {
                const scenarioRows = scenarios.filter((row) => row.condition === condition);
                const beliefRows = beliefs.filter((row) => row.condition === condition);
                return (
                  <tr key={condition} className="border-b border-stone-200">
                    <td className="py-2 pr-3">{condition}</td>
                    <td className="py-2 pr-3">{scenarioRows.length || "—"}</td>
                    <td className="py-2 pr-3">
                      {rate(scenarioRows, (row) => isTrue((row as ScenarioRow).decision_correct))}
                    </td>
                    <td className="py-2 pr-3">
                      {rate(scenarioRows, (row) => isTrue((row as ScenarioRow).human_fever_correct))}
                    </td>
                    <td className="py-2 pr-3">
                      {rate(beliefRows, (row) => isTrue((row as BeliefRow).belief_correct))}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 text-lg font-medium">Beliefs by quadrant</h2>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-stone-300">
              <th className="py-2 pr-3 font-medium">Condition</th>
              <th className="py-2 pr-3 font-medium">Quadrant</th>
              <th className="py-2 pr-3 font-medium">Beliefs</th>
              <th className="py-2 pr-3 font-medium">Belief correct</th>
            </tr>
          </thead>
          <tbody>
            {conditions.length === 0 || quadrants.length === 0 ? (
              <tr>
                <td className="py-2" colSpan={4}>
                  —
                </td>
              </tr>
            ) : (
              conditions.flatMap((condition) =>
                quadrants.map((quadrant) => {
                  const rows = beliefs.filter(
                    (row) => row.condition === condition && row.quadrant === quadrant,
                  );
                  if (rows.length === 0) return null;
                  return (
                    <tr key={`${condition}-${quadrant}`} className="border-b border-stone-200">
                      <td className="py-2 pr-3">{condition}</td>
                      <td className="py-2 pr-3">{quadrant}</td>
                      <td className="py-2 pr-3">{rows.length}</td>
                      <td className="py-2 pr-3">
                        {rate(rows, (row) => isTrue((row as BeliefRow).belief_correct))}
                      </td>
                    </tr>
                  );
                }),
              )
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
