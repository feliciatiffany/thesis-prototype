import { useState } from "react";
import { RestartButton } from "../components/RestartButton.tsx";
import { readStudyParams } from "../lib/assignment.ts";
import { useStudy } from "../store/useStudy.ts";

export function ConsentScreen() {
  const start = useStudy((state) => state.start);
  const params = readStudyParams();
  const [pid, setPid] = useState(params.pid);
  const [agreed, setAgreed] = useState(false);
  const ready = pid.trim().length > 0 && agreed;

  return (
    <main className="screen">
      <div className="screen-card">
      <h1 className="text-2xl font-medium">Two Kinds of Doubt</h1>
      <p className="mt-3 leading-relaxed">
        You will chat with an assistant about a few everyday choices, then say what you would
        decide. The assistant’s replies are prepared for this study. Please use what you see in the
        chat, not outside knowledge.
      </p>
      <form
        className="mt-6 space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) start(pid);
        }}
      >
        <label className="block text-sm">
          Participant ID
          <input
            value={pid}
            onChange={(event) => setPid(event.target.value)}
            className="composer mt-1 w-full"
            autoComplete="off"
          />
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
          <span>I agree to take part and for my answers to be saved in this browser.</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={!ready}
            className="primary"
          >
            Start
          </button>
          <RestartButton />
        </div>
      </form>
      </div>
    </main>
  );
}

export function ConflictScreen() {
  const pid = useStudy((state) => state.pid);
  const conflictPid = useStudy((state) => state.conflictPid);
  const keepSaved = useStudy((state) => state.keepSaved);
  const discardSaved = useStudy((state) => state.discardSaved);
  return (
    <main className="screen">
      <div className="screen-card">
      <h1 className="text-2xl font-medium">A session is already saved</h1>
      <p className="mt-3 leading-relaxed">
        This browser has a session for {pid}. This link is for {conflictPid}.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" className="primary" onClick={keepSaved}>
          Continue {pid}
        </button>
        <button type="button" className="ghost" onClick={discardSaved}>
          Start {conflictPid} instead
        </button>
        <RestartButton />
      </div>
      </div>
    </main>
  );
}
