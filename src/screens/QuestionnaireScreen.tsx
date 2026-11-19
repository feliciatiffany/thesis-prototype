import { useState } from "react";
import { RestartButton } from "../components/RestartButton.tsx";
import { NASA_TLX, TRUST_ITEMS } from "../config.ts";
import { useStudy } from "../store/useStudy.ts";

export function QuestionnaireScreen() {
  const condition = useStudy(
    (state) => state.scenarioConditions[state.scenarioIndex] ?? "A",
  );
  const submitQuestionnaire = useStudy((state) => state.submitQuestionnaire);
  const [sliders, setSliders] = useState<Record<string, number>>({
    mental: 50,
    performance: 50,
    effort: 50,
    frustration: 50,
  });
  const [trust, setTrust] = useState<Record<string, number | null>>({
    trust_ai: null,
    trust_markers: null,
    would_use: null,
  });
  const items = TRUST_ITEMS.filter(
    (item) => !("conditions" in item) || item.conditions.includes(condition as "B" | "C" | "D"),
  );
  const ready = items.every((item) => trust[item.id] != null);

  return (
    <main className="screen" style={{ justifyContent: "flex-start" }}>
      <div className="screen-card">
      <h1 className="text-xl font-medium">About that conversation</h1>
      <form
        className="mt-4 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!ready) return;
          submitQuestionnaire({
            mental: sliders.mental ?? 50,
            performance: sliders.performance ?? 50,
            effort: sliders.effort ?? 50,
            frustration: sliders.frustration ?? 50,
            trust_ai: trust.trust_ai ?? 1,
            trust_markers: condition === "A" ? null : (trust.trust_markers ?? null),
            would_use: trust.would_use ?? 1,
          });
        }}
      >
        {NASA_TLX.map((item) => (
          <label key={item.id} className="block">
            <span className="text-sm">{item.label}</span>
            <span className="mt-1 flex items-center gap-3 text-xs text-stone-500">
              <span>{item.low}</span>
              <input
                type="range"
                min={0}
                max={100}
                value={sliders[item.id] ?? 50}
                aria-valuetext={String(sliders[item.id] ?? 50)}
                className="flex-1"
                onChange={(event) =>
                  setSliders((current) => ({ ...current, [item.id]: Number(event.target.value) }))
                }
              />
              <span>{item.high}</span>
              <span className="w-8 text-right text-stone-800">{sliders[item.id] ?? 50}</span>
            </span>
          </label>
        ))}
        {items.map((item) => (
          <fieldset key={item.id}>
            <legend className="text-sm">{item.label}</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                <label key={score} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={item.id}
                    checked={trust[item.id] === score}
                    onChange={() => setTrust((current) => ({ ...current, [item.id]: score }))}
                  />
                  {score}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!ready}
            className="primary"
          >
            Continue
          </button>
          <RestartButton />
        </div>
      </form>
      </div>
    </main>
  );
}
