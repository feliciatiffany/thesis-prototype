import { Frame } from "../components/Frame.tsx";
import { useStudy } from "../context/StudyContext.tsx";
import { actionLabel } from "../lib/labels.ts";

export function ConfidenceScreen() {
  const study = useStudy();
  const task = study.currentTask;
  if (!task) return null;
  const ready = task.claims.every((claim) => study.state.claimStates[claim.id]?.confidence != null);

  return (
    <Frame title="How sure are you?">
      <p>
        For each claim, rate the wording you are leaving in the answer. 1 means not sure at all. 7
        means very sure.
      </p>
      <div className="space-y-6">
        {task.claims.map((claim) => {
          const runtime = study.state.claimStates[claim.id];
          if (!runtime) return null;
          const shown = runtime.action === "delete" ? claim.text : runtime.finalText;
          return (
            <fieldset key={claim.id} className="rounded-md border border-stone-300 bg-white p-4">
              <legend className="px-1 text-sm font-medium text-stone-600">
                {runtime.action ? actionLabel(runtime.action) : "No decision"}
              </legend>
              <p className={`reading mt-2 text-stone-950 ${runtime.action === "delete" ? "line-through" : ""}`}>
                {shown}
              </p>
              <p className="mt-3 text-sm font-medium text-stone-900" id={`${claim.id}-sure`}>
                How sure are you this claim is now correct?
              </p>
              <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`${claim.id}-sure`}>
                {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                  <label
                    key={score}
                    className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-900 ${
                      runtime.confidence === score
                        ? "border-stone-900 bg-stone-900 text-white"
                        : "border-stone-400 bg-white text-stone-900"
                    }`}
                  >
                    <input
                      type="radio"
                      className="sr-only"
                      name={`confidence-${claim.id}`}
                      value={score}
                      checked={runtime.confidence === score}
                      onChange={() => study.setConfidence(claim.id, score)}
                    />
                    {score}
                  </label>
                ))}
              </div>
              <p className="mt-2 flex justify-between text-sm text-stone-600">
                <span>Not sure</span>
                <span>Very sure</span>
              </p>
            </fieldset>
          );
        })}
      </div>
      <button
        type="button"
        disabled={!ready}
        onClick={study.advanceToQuestionnaire}
        className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
      >
        Continue to the questions
      </button>
    </Frame>
  );
}
