import { useEffect, useRef, useState } from "react";
import { ActionBar } from "../components/ActionBar.tsx";
import { ConsistencyBar } from "../components/ConsistencyBar.tsx";
import { EvidenceStep } from "../components/EvidenceStep.tsx";
import { Frame } from "../components/Frame.tsx";
import { QuadrantLegend } from "../components/QuadrantLegend.tsx";
import { VerdictBadge } from "../components/VerdictBadge.tsx";
import { TUTORIAL_MS } from "../config.ts";
import { useStudy } from "../context/StudyContext.tsx";
import type { Condition, HandlingAction, Passage } from "../types.ts";

const STEPS: Record<Exclude<Condition, "A">, { title: string; body: string }[]> = {
  B: [
    {
      title: "Agreement, not truth",
      body: "Each claim shows how many of 10 sampled answers used that wording. “7 of 10 samples say this” means the model repeated itself. It does not mean the claim is right.",
    },
    {
      title: "Other samples",
      body: "Open “Show other samples” to read values the other runs used instead. A low bar means the model wavered. A high bar means it kept saying the same thing.",
    },
    {
      title: "The display is the same everywhere",
      body: "Every claim gets the same kind of mark. Nothing is singled out as riskier than the rest. You still decide what a friend should read.",
    },
    {
      title: "Try it",
      body: "Open the practice claim’s other samples, then continue. The button waits until a minute has passed so this walkthrough is not skipped.",
    },
  ],
  C: [
    {
      title: "Three source verdicts",
      body: "Each claim is marked Supported, Refuted, or Not enough info. These are different. The interface never folds the last two into one “unsupported” state.",
    },
    {
      title: "Contradiction and silence",
      body: "Refuted means the sources contradict the claim: “Sources contradict this.” Not enough info means the sources do not mention it: “No source covers this.”",
    },
    {
      title: "Read the passage",
      body: "Open the matched passage to see the wording the mark is based on. A coverage bar under the answer lists source points the answer left out.",
    },
    {
      title: "Try it",
      body: "Look at the three marks below. They stay visually distinct on purpose. Continue unlocks after about a minute.",
    },
  ],
  D: [
    {
      title: "Two signals at once",
      body: "Every claim carries both signals: how often the AI repeated it, and what the sources say. The label and the icon name the combination. Color repeats that same information.",
    },
    {
      title: "Four kinds of doubt",
      body: "Open “What does this mean?” to see the grid. Consistency runs up and down. Source support runs left to right. The cell marked “This claim” is the one you have open.",
    },
    {
      title: "The risky claim is locked",
      body: "When the AI repeats a claim the sources do not back, the claim stays locked until you choose an action and point to a passage, or say that no source covers it.",
    },
    {
      title: "Contradiction is not a gap",
      body: "Refuted still means the sources contradict the claim. Not enough info still means they do not cover it. Deleting or correcting fits a contradiction. Hedging or searching fits a gap.",
    },
    {
      title: "Try the lock",
      body: "The practice claim below does not count until you pick an action and a justification. Continue unlocks after about a minute, whether or not you finish the practice.",
    },
  ],
};

const PRACTICE_PASSAGE: Passage = {
  id: "practice-p1",
  source_title: "Practice source",
  text: "This practice passage does not mention the claim. It is here so you can see the justification step.",
};

export function TutorialScreen() {
  const study = useStudy();
  const condition = study.state.tutorialCondition;
  const steps = condition && condition !== "A" ? STEPS[condition] : [];
  const [step, setStep] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const fallbackStart = useRef(Date.now());
  const startedAt = study.state.tutorialStartedAt ?? fallbackStart.current;

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  if (!condition || condition === "A") {
    return (
      <Frame title="Tutorial">
        <p>This condition does not include a tutorial.</p>
        <button type="button" onClick={study.completeTutorial} className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white">
          Continue
        </button>
      </Frame>
    );
  }

  const current = steps[step] ?? steps[0];
  const last = step === steps.length - 1;
  const remaining = Math.max(0, TUTORIAL_MS - (now - startedAt));
  const unlocked = study.debug || remaining === 0;
  const seconds = Math.ceil(remaining / 1000);

  return (
    <Frame title="How to read this interface">
      <p>This walkthrough takes about a minute. You will use these signals in the task that follows.</p>
      <p className="text-sm text-stone-600">
        Step {step + 1} of {steps.length}
        {unlocked ? "" : ` · Continue unlocks in ${seconds} seconds`}
      </p>
      <section className="rounded-md border border-stone-300 bg-white p-5">
        <h2 className="text-xl font-medium text-stone-950">{current?.title}</h2>
        <p className="mt-2">{current?.body}</p>
      </section>
      {last ? <Practice condition={condition} /> : null}
      <div className="flex flex-wrap gap-3">
        {step > 0 ? (
          <button
            type="button"
            onClick={() => setStep((value) => value - 1)}
            className="rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-medium text-stone-900"
          >
            Back
          </button>
        ) : null}
        {last ? null : (
          <button
            type="button"
            onClick={() => setStep((value) => value + 1)}
            className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
          >
            Next
          </button>
        )}
        {last ? (
          <button
            type="button"
            disabled={!unlocked}
            onClick={study.completeTutorial}
            className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
          >
            Continue to the task
          </button>
        ) : null}
        {study.debug ? (
          <button
            type="button"
            onClick={study.completeTutorial}
            className="rounded-md border border-stone-400 px-4 py-2 text-sm text-stone-800"
          >
            Skip tutorial
          </button>
        ) : null}
      </div>
    </Frame>
  );
}

function Practice({ condition }: { condition: Exclude<Condition, "A"> }) {
  const [action, setAction] = useState<HandlingAction | null>(null);
  const [evidence, setEvidence] = useState<string | null>(null);
  const [showAlt, setShowAlt] = useState(false);
  const handled = Boolean(action && evidence);

  if (condition === "B") {
    return (
      <section className="rounded-md border border-stone-300 bg-white p-5" aria-label="Practice claim">
        <p className="text-sm font-medium text-stone-600">Practice claim</p>
        <p className="reading mt-2 text-stone-950">The tower is 330 metres tall.</p>
        <div className="mt-4">
          <ConsistencyBar agree={7} total={10} />
        </div>
        {showAlt ? (
          <p className="mt-3 text-sm">Other samples said: 324 metres, 312 metres.</p>
        ) : (
          <button
            type="button"
            className="mt-3 rounded-md border border-stone-400 bg-white px-3 py-2 text-sm"
            onClick={() => setShowAlt(true)}
          >
            Show other samples
          </button>
        )}
      </section>
    );
  }

  if (condition === "C") {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        <VerdictBadge verdict="SUPPORTED" />
        <VerdictBadge verdict="REFUTED" />
        <VerdictBadge verdict="NEI" />
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-md border border-red-800 bg-red-50 p-5" aria-label="Practice claim">
      <p className="flex items-center gap-2 font-medium text-red-950">
        Repeated by the AI, not backed by sources
        {handled ? " · Handled" : " · Locked"}
      </p>
      <p className="text-sm text-red-950">No source covers this</p>
      <p className="reading text-stone-950">Practice: the tower has exactly 1,665 steps.</p>
      <QuadrantLegend current="confidently_wrong" onOpen={() => undefined} />
      <ActionBar
        condition="D"
        quadrant="confidently_wrong"
        verdict="NEI"
        hasSourceWording={false}
        flagged={false}
        onAction={(next) => {
          setAction(next);
          setEvidence(null);
        }}
        onSearch={() => undefined}
        onFlag={() => undefined}
      />
      {action && !evidence ? (
        <EvidenceStep
          claimId="practice"
          required
          passages={[PRACTICE_PASSAGE]}
          extraPassages={[]}
          showExtra={false}
          onConfirm={setEvidence}
          onSkip={() => undefined}
        />
      ) : null}
      {handled ? <p className="text-sm font-medium text-stone-900">This practice claim is now handled.</p> : null}
    </section>
  );
}
