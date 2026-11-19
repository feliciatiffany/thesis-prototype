import { useState } from "react";
import { RestartButton } from "./RestartButton.tsx";
import { scenarioById } from "../lib/data.ts";
import { useStudy } from "../store/useStudy.ts";
import type { BeliefValue } from "../types.ts";

const BELIEFS: BeliefValue[] = ["True", "False", "Not sure"];

export function DecisionDialog() {
  const order = useStudy((state) => state.scenarioOrder);
  const index = useStudy((state) => state.scenarioIndex);
  const closeDecision = useStudy((state) => state.closeDecision);
  const submitDecision = useStudy((state) => state.submitDecision);
  const scenario = scenarioById(order[index] ?? "");
  const [optionId, setOptionId] = useState("");
  const [reasons, setReasons] = useState<string[]>([]);
  const [otherOn, setOtherOn] = useState(false);
  const [otherText, setOtherText] = useState("");
  const [beliefs, setBeliefs] = useState<Record<string, BeliefValue | "">>({});
  const [confidence, setConfidence] = useState<Record<string, number | "">>({});

  if (!scenario) return null;
  const keyClaims = scenario.claims.filter((claim) => claim.key_claim);
  const selectedCount = reasons.length + (otherOn ? 1 : 0);
  const beliefsReady = keyClaims.every(
    (claim) => beliefs[claim.id] && confidence[claim.id] !== "" && confidence[claim.id] != null,
  );
  const otherReady = !otherOn || otherText.trim().length > 0;
  const ready = optionId !== "" && selectedCount > 0 && selectedCount <= 2 && otherReady && beliefsReady;

  const toggleReason = (id: string) => {
    setReasons((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length + (otherOn ? 1 : 0) >= 2) return current;
      return [...current, id];
    });
  };

  return (
    <div className="fixed inset-0 z-30 overflow-y-auto bg-stone-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="decision-title"
        className="screen-card mx-auto my-4 max-w-[720px]"
      >
        <h2 id="decision-title" className="text-lg font-medium">
          {scenario.decision.prompt}
        </h2>
        <fieldset className="mt-4 space-y-2">
          <legend className="text-sm font-medium">Your choice</legend>
          {scenario.decision.options.map((option) => (
            <label key={option.id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2">
              <input
                type="radio"
                name="decision"
                value={option.id}
                checked={optionId === option.id}
                onChange={() => setOptionId(option.id)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="mt-5">
          <legend className="text-sm font-medium">What was the most important reason?</legend>
          <p className="mt-1 mb-2 text-sm text-stone-600">Pick up to 2.</p>
          <div className="space-y-2">
            {scenario.claims.map((claim) => {
              const checked = reasons.includes(claim.id);
              const disabled = !checked && selectedCount >= 2;
              return (
                <label key={claim.id} className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggleReason(claim.id)}
                  />
                  <span>{claim.text}</span>
                </label>
              );
            })}
            <label className="flex items-start gap-2 rounded-xl bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                checked={otherOn}
                disabled={!otherOn && selectedCount >= 2}
                onChange={() => {
                  if (otherOn) {
                    setOtherOn(false);
                    return;
                  }
                  if (selectedCount >= 2) return;
                  setOtherOn(true);
                }}
              />
              <span>Something else</span>
            </label>
            {otherOn ? (
              <textarea
                value={otherText}
                onChange={(event) => setOtherText(event.target.value)}
                rows={2}
                aria-label="Something else"
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm"
              />
            ) : null}
          </div>
        </fieldset>
        <div className="mt-5 space-y-4">
          <h3 className="text-sm font-medium">Do you believe this is true?</h3>
          {keyClaims.map((claim) => (
            <fieldset key={claim.id} className="rounded-xl bg-white p-3">
              <legend className="text-sm">{claim.text}</legend>
              <div className="mt-2 flex flex-wrap gap-3 text-sm">
                {BELIEFS.map((value) => (
                  <label key={value} className="flex items-center gap-1">
                    <input
                      type="radio"
                      name={`belief-${claim.id}`}
                      checked={beliefs[claim.id] === value}
                      onChange={() => setBeliefs((current) => ({ ...current, [claim.id]: value }))}
                    />
                    {value}
                  </label>
                ))}
              </div>
              <label className="mt-2 block text-sm">
                Confidence, 1 to 7
                <select
                  className="mt-1 block rounded-lg border border-stone-300 bg-white px-2 py-1"
                  value={confidence[claim.id] ?? ""}
                  onChange={(event) =>
                    setConfidence((current) => ({
                      ...current,
                      [claim.id]: event.target.value === "" ? "" : Number(event.target.value),
                    }))
                  }
                >
                  <option value="">Choose</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                    <option key={score} value={score}>
                      {score}
                    </option>
                  ))}
                </select>
              </label>
            </fieldset>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            disabled={!ready}
            onClick={() =>
              submitDecision({
                optionId,
                reasonClaimIds: reasons,
                otherReason: otherOn ? otherText.trim() : "",
                beliefs: keyClaims.map((claim) => ({
                  claimId: claim.id,
                  belief: beliefs[claim.id] as BeliefValue,
                  confidence: Number(confidence[claim.id]),
                })),
              })
            }
          >
            Submit decision
          </button>
          <button type="button" className="rounded-full border border-stone-400 px-4 py-2 text-sm" onClick={closeDecision}>
            Back to the chat
          </button>
          <RestartButton />
        </div>
      </div>
    </div>
  );
}
