export function TopBar({
  pid,
  taskNumber,
  taskTotal,
  handled,
  total,
  canSubmit,
  openEvidence,
  onSubmit,
}: {
  pid: string;
  taskNumber: number;
  taskTotal: number;
  handled: number;
  total: number;
  canSubmit: boolean;
  openEvidence: number;
  onSubmit: () => void;
}) {
  const remaining = total - handled;
  return (
    <header className="flex items-center justify-between gap-6 border-b border-stone-300 bg-[#fffcf8] px-6 py-3">
      <div>
        <p className="text-sm font-medium text-stone-900">Two Kinds of Doubt</p>
        <p className="text-sm text-stone-600">Participant {pid}</p>
      </div>
      <p className="text-sm font-medium text-stone-800">
        Task {taskNumber} of {taskTotal}
      </p>
      <div className="flex items-center gap-4">
        <p className="text-sm text-stone-800" aria-live="polite">
          {handled} of {total} claims handled
          {openEvidence > 0 ? ` · ${openEvidence} still asking why` : ""}
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          aria-describedby="submit-hint"
          className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
        >
          Submit
        </button>
        <p id="submit-hint" className="sr-only">
          {canSubmit
            ? "All claims have a decision."
            : `${remaining} claims still need a decision before you can submit.`}
        </p>
      </div>
    </header>
  );
}
