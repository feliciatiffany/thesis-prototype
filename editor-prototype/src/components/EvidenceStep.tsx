import { useState } from "react";
import type { Passage } from "../types.ts";

export function EvidenceStep({
  claimId,
  required,
  passages,
  extraPassages,
  showExtra,
  onConfirm,
  onSkip,
}: {
  claimId: string;
  required: boolean;
  passages: Passage[];
  extraPassages: Passage[];
  showExtra: boolean;
  onConfirm: (evidenceId: string) => void;
  onSkip: () => void;
}) {
  const [choice, setChoice] = useState("");
  const name = `evidence-${claimId}`;

  return (
    <fieldset className="rounded-md border border-stone-400 bg-white p-4">
      <legend className="px-1 text-base font-medium text-stone-900">
        Why? Select the source passage that justifies this, or choose “No source covers this”.
      </legend>
      <p className="mt-2 text-sm text-stone-700">
        {required
          ? "This choice is required before the claim counts as handled."
          : "This choice is optional. You can continue without it."}
      </p>
      <div className="mt-3 space-y-2">
        {passages.map((passage) => (
          <label
            key={passage.id}
            className="block cursor-pointer rounded-md border border-stone-300 px-3 py-2 hover:bg-stone-50"
          >
            <span className="flex items-start gap-2">
              <input
                className="mt-1"
                type="radio"
                name={name}
                value={passage.id}
                checked={choice === passage.id}
                onChange={() => setChoice(passage.id)}
              />
              <span>
                <span className="block font-medium text-stone-900">{passage.source_title}</span>
                <span className="reading mt-1 block text-stone-800">{passage.text}</span>
              </span>
            </span>
          </label>
        ))}
        {showExtra && extraPassages.length > 0 ? (
          <div className="pt-2">
            <p className="text-sm font-medium text-stone-800">From further search</p>
            <div className="mt-2 space-y-2">
              {extraPassages.map((passage) => (
                <label
                  key={passage.id}
                  className="block cursor-pointer rounded-md border border-stone-300 px-3 py-2 hover:bg-stone-50"
                >
                  <span className="flex items-start gap-2">
                    <input
                      className="mt-1"
                      type="radio"
                      name={name}
                      value={passage.id}
                      checked={choice === passage.id}
                      onChange={() => setChoice(passage.id)}
                    />
                    <span>
                      <span className="block font-medium text-stone-900">{passage.source_title}</span>
                      <span className="reading mt-1 block text-stone-800">{passage.text}</span>
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <label className="block cursor-pointer rounded-md border border-stone-300 px-3 py-2 hover:bg-stone-50">
          <span className="flex items-center gap-2">
            <input
              type="radio"
              name={name}
              value="none"
              checked={choice === "none"}
              onChange={() => setChoice("none")}
            />
            <span className="font-medium text-stone-900">No source covers this</span>
          </span>
        </label>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!choice}
          onClick={() => choice && onConfirm(choice)}
          className="rounded-md border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use this justification
        </button>
        {required ? null : (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-900"
          >
            Continue without selecting a source
          </button>
        )}
      </div>
    </fieldset>
  );
}
