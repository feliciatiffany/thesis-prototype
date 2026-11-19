export function ConsistencyBar({ agree, total }: { agree: number; total: number }) {
  const pct = total <= 0 ? 0 : Math.round((agree / total) * 100);
  return (
    <div>
      <p className="font-medium text-stone-900">
        {agree} of {total} samples say this
      </p>
      <div
        className="mt-2 h-3 w-full rounded-full border border-stone-400 bg-white"
        role="img"
        aria-label={`${agree} of ${total} samples agree with this wording`}
      >
        <div className="h-full rounded-full bg-stone-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
