import { useState } from "react";
import { Frame } from "../components/Frame.tsx";
import { useStudy } from "../context/StudyContext.tsx";
import { conditionFromPid, hashPid, latinSquareOrder } from "../lib/assignment.ts";
import { tasks } from "../lib/data.ts";

export function ConsentScreen() {
  const study = useStudy();
  const [pid, setPid] = useState(study.pidFromUrl);
  const [agreed, setAgreed] = useState(false);
  const trimmed = pid.trim();
  const ready = trimmed.length > 0 && agreed;

  return (
    <Frame title="Before you begin">
      <p>
        In this session you will read a few AI-written answers and the sources that came with
        them. Your job is to prepare each answer to share with a friend. Make sure it is accurate.
        You can keep, edit, or remove parts of the text.
      </p>
      <p>
        Your edits stay in this browser until you download them at the end. Nothing is sent to a
        server.
      </p>
      <div>
        <label htmlFor="pid" className="block text-sm font-medium text-stone-900">
          Participant ID
        </label>
        <input
          id="pid"
          value={pid}
          onChange={(event) => setPid(event.target.value)}
          autoComplete="off"
          className="mt-2 w-full max-w-sm rounded-md border border-stone-400 bg-white px-3 py-2 text-stone-950"
        />
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          className="mt-1"
          checked={agreed}
          onChange={(event) => setAgreed(event.target.checked)}
        />
        <span>I have read this and I am ready to begin.</span>
      </label>
      {study.debug && trimmed ? <AssignmentPreview pid={trimmed} fromUrl={study.conditionFromUrl} /> : null}
      <button
        type="button"
        disabled={!ready}
        onClick={() => study.start(trimmed)}
        className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:border-stone-300 disabled:bg-stone-200 disabled:text-stone-600"
      >
        Begin
      </button>
    </Frame>
  );
}

function AssignmentPreview({
  pid,
  fromUrl,
}: {
  pid: string;
  fromUrl: string | null;
}) {
  const order = latinSquareOrder(
    pid,
    tasks.map((task) => task.id),
  );
  return (
    <div className="rounded-md border border-stone-300 bg-white p-3 text-sm">
      <p>Hash {hashPid(pid)}.</p>
      {fromUrl ? (
        <p>The URL fixes condition {fromUrl}. Task order would be {order.join(" → ")}.</p>
      ) : (
        <p>
          No condition in the URL. This ID would be assigned to condition {conditionFromPid(pid)}{" "}
          (hash mod 4). Task order {order.join(" → ")} (hash mod 3).
        </p>
      )}
    </div>
  );
}

export function ConflictScreen() {
  const study = useStudy();
  return (
    <Frame title="A session is already in this browser">
      <p>
        Saved session: participant {study.state.pid}. This link asks for participant{" "}
        {study.pidFromUrl}.
      </p>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={study.keepSaved}
          className="rounded-md border border-stone-900 bg-stone-900 px-4 py-2 text-sm font-medium text-white"
        >
          Continue {study.state.pid}
        </button>
        <button
          type="button"
          onClick={study.startNewInstead}
          className="rounded-md border border-stone-400 bg-white px-4 py-2 text-sm font-medium text-stone-900"
        >
          Start {study.pidFromUrl} instead
        </button>
      </div>
    </Frame>
  );
}
