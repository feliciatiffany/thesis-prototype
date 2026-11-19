import type { Passage } from "../types.ts";

export function SearchPanel({
  passages,
  onClose,
}: {
  passages: Passage[];
  onClose: () => void;
}) {
  return (
    <section className="rounded-md border border-stone-400 bg-white p-4" aria-label="Further search">
      <h3 className="text-base font-medium text-stone-900">Further search</h3>
      <p className="mt-1 text-sm text-stone-700">
        This stands in for looking up more sources. It does not count as your decision. These
        passages may not mention the claim you have open.
      </p>
      {passages.length === 0 ? (
        <p className="mt-3 text-stone-800">No further passages are available.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {passages.map((passage) => (
            <li key={passage.id} className="border-t border-stone-200 pt-3">
              <p className="font-medium text-stone-900">{passage.source_title}</p>
              <p className="reading mt-1 text-stone-800">{passage.text}</p>
            </li>
          ))}
        </ul>
      )}
      <button
        type="button"
        onClick={onClose}
        className="mt-4 rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-900"
      >
        Close search
      </button>
    </section>
  );
}
