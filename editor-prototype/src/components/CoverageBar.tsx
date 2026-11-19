import type { Task } from "../types.ts";

export function CoverageBar({ task }: { task: Task }) {
  const included = new Set(task.claims.flatMap((claim) => claim.evidence_ids)).size;
  const omitted = task.omitted_source_claims.length;
  const total = included + omitted;
  const pct = total === 0 ? 0 : Math.round((included / total) * 100);

  return (
    <section className="mt-10 border-t border-stone-300 pt-6" aria-label="Source coverage">
      <h2 className="text-lg font-medium text-stone-900">Source points left out of the answer</h2>
      <p className="mt-2 text-stone-700">
        {included} of {total} source points appear in the answer. {omitted}{" "}
        {omitted === 1 ? "is" : "are"} left out.
      </p>
      <div
        className="mt-3 h-3 w-full rounded-full border border-stone-400 bg-white"
        role="img"
        aria-label={`${included} of ${total} source points appear in the answer. ${omitted} left out.`}
      >
        <div className="h-full rounded-full bg-stone-700" style={{ width: `${pct}%` }} />
      </div>
      {omitted > 0 ? (
        <ul className="mt-4 list-disc space-y-2 pl-5 text-stone-800">
          {task.omitted_source_claims.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-stone-700">No listed source point is missing from the answer.</p>
      )}
    </section>
  );
}
