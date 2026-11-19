import { useState } from "react";
import { Frame } from "../components/Frame.tsx";
import { NASA_TLX, TRUST_ITEMS } from "../config.ts";
import { useStudy } from "../context/StudyContext.tsx";

export function QuestionnaireScreen() {
  const study = useStudy();
  const task = study.currentTask;
  const taskId = task?.id ?? "task";
  const [values, setValues] = useState<Record<string, number | null>>(() => {
    const initial: Record<string, number | null> = {};
    for (const item of [...NASA_TLX, ...TRUST_ITEMS]) {
      const stored = study.state.draftAnswers[`${taskId}:${item.id}`];
      initial[item.id] = stored ?? null;
    }
    return initial;
  });

  const ready = [...NASA_TLX, ...TRUST_ITEMS].every((item) => values[item.id] != null);
  const last = study.state.taskIndex >= study.state.taskOrder.length - 1;

  function setValue(id: string, value: number) {
    setValues((current) => ({ ...current, [id]: value }));
    study.setDraft(`${taskId}:${id}`, value);
  }

  return (
    <Frame title="About that task">
      <p>
        Move each slider. If the spot already looks right, click it so the answer is recorded. On
        Performance, the left side is Good and the right side is Poor.
      </p>
      <div className="space-y-6">
        {NASA_TLX.map((item) => (
          <SliderField
            key={item.id}
            id={item.id}
            label={item.label}
            question={item.question}
            low={item.low}
            high={item.high}
            value={values[item.id] ?? null}
            onChange={(value) => setValue(item.id, value)}
          />
        ))}
      </div>
      <div className="space-y-6">
        {TRUST_ITEMS.map((item) => (
          <fieldset key={item.id} className="rounded-md border border-stone-300 bg-white p-4">
            <legend className="px-1 font-medium text-stone-950">{item.label}</legend>
            <div className="mt-3 flex flex-wrap gap-2" role="radiogroup" aria-label={item.label}>
              {[1, 2, 3, 4, 5, 6, 7].map((score) => (
                <label
                  key={score}
                  className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-md border text-sm font-medium focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-blue-900 ${
                    values[item.id] === score
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-400 bg-white text-stone-900"
                  }`}
                >
                  <input
                    type="radio"
                    className="sr-only"
                    name={item.id}
                    value={score}
                    checked={values[item.id] === score}
                    onChange={() => setValue(item.id, score)}
                  />
                  {score}
                </label>
              ))}
            </div>
            <p className="mt-2 flex justify-between text-sm text-stone-600">
              <span>Strongly disagree</span>
              <span>Strongly agree</span>
            </p>
          </fieldset>
        ))}
      </div>
      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!ready) return;
          study.submitQuestionnaire({
            mental: values.mental ?? 0,
            physical: values.physical ?? 0,
            temporal: values.temporal ?? 0,
            performance: values.performance ?? 0,
            effort: values.effort ?? 0,
            frustration: values.frustration ?? 0,
            trust_ai: values.trust_ai ?? 0,
            trust_interface: values.trust_interface ?? 0,
            control: values.control ?? 0,
          });
        }}
        className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
      >
        {last ? "Finish session" : "Next task"}
      </button>
    </Frame>
  );
}

function SliderField({
  id,
  label,
  question,
  low,
  high,
  value,
  onChange,
}: {
  id: string;
  label: string;
  question: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-md border border-stone-300 bg-white p-4">
      <label htmlFor={id} className="block font-medium text-stone-950">
        {label}
      </label>
      <p className="mt-1 text-sm text-stone-700">{question}</p>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={value ?? 50}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={value == null ? "Not set" : String(value)}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-4 w-full"
      />
      <p className="mt-1 flex justify-between text-sm text-stone-600">
        <span>{low}</span>
        <span className="font-medium text-stone-900">{value == null ? "Not set" : value}</span>
        <span>{high}</span>
      </p>
    </div>
  );
}
