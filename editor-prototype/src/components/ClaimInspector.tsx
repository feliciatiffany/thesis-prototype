import { useEffect, useState, type ReactNode } from "react";
import { HEDGE_PREFIX, QUADRANT_LABEL } from "../config.ts";
import { actionLabel, evidenceIsRequired, suggestionCopy, verdictDetail } from "../lib/labels.ts";
import type { DerivedClaim } from "../lib/quadrant.ts";
import { passageById } from "../lib/data.ts";
import type { ClaimRuntime, Condition, HandlingAction, Passage, Task } from "../types.ts";
import { ActionBar } from "./ActionBar.tsx";
import { ConsistencyBar } from "./ConsistencyBar.tsx";
import { EvidenceStep } from "./EvidenceStep.tsx";
import { QuadrantIcon } from "./QuadrantIcon.tsx";
import { QuadrantLegend } from "./QuadrantLegend.tsx";
import { SearchPanel } from "./SearchPanel.tsx";
import { VerdictBadge } from "./VerdictBadge.tsx";
import { IconLock } from "./Icons.tsx";

const QUADRANT_CHROME = {
  solid: "border-stone-400 bg-stone-100 text-stone-800",
  confidently_wrong: "border-red-800 bg-red-50 text-red-950",
  speculation: "border-amber-800 bg-amber-50 text-amber-950",
  unstable_sourced: "border-blue-800 bg-blue-50 text-blue-950",
} as const;

export function ClaimInspector({
  condition,
  task,
  claim,
  runtime,
  focusedPassage,
  onCommit,
  onEvidence,
  onSkipEvidence,
  onSearch,
  onFlag,
  onDetail,
  onAlternatives,
  onLegend,
  onClearPassage,
}: {
  condition: Condition;
  task: Task;
  claim: DerivedClaim | null;
  runtime: ClaimRuntime | null;
  focusedPassage: Passage | null;
  onCommit: (action: HandlingAction, text: string) => void;
  onEvidence: (evidenceId: string) => void;
  onSkipEvidence: () => void;
  onSearch: () => void;
  onFlag: () => void;
  onDetail: (target: string) => void;
  onAlternatives: () => void;
  onLegend: () => void;
  onClearPassage: () => void;
}) {
  const [editMode, setEditMode] = useState<"hedge" | "rewrite" | null>(null);
  const [draft, setDraft] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showPassages, setShowPassages] = useState(false);
  const [showAlternatives, setShowAlternatives] = useState(false);
  const [showSolid, setShowSolid] = useState(false);

  useEffect(() => {
    setEditMode(null);
    setDraft("");
    setShowSearch(false);
    setShowPassages(false);
    setShowAlternatives(false);
    setShowSolid(false);
  }, [claim?.id]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-stone-300 px-6 py-4">
        <h2 className="text-sm font-medium tracking-wide text-stone-600 uppercase">Claim</h2>
      </div>
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        {focusedPassage ? (
          <PassageCard
            passage={focusedPassage}
            onClose={onClearPassage}
            heading="Source"
          />
        ) : null}
        {!claim || !runtime ? (
          <p className="text-stone-700">
            Select a claim in the answer. Every claim needs a decision before you can submit.
          </p>
        ) : (
          <ClaimBody
            condition={condition}
            task={task}
            claim={claim}
            runtime={runtime}
            editMode={editMode}
            draft={draft}
            showSearch={showSearch}
            showPassages={showPassages}
            showAlternatives={showAlternatives}
            showSolid={showSolid}
            onDraft={setDraft}
            onCancelEdit={() => setEditMode(null)}
            onSaveEdit={() => {
              if (!editMode) return;
              const text = draft.trim();
              if (!text) return;
              onCommit(editMode, text);
              setEditMode(null);
            }}
            onAction={(action) => {
              if (action === "hedge") {
                setEditMode("hedge");
                setDraft(`${HEDGE_PREFIX}${claim.text}`);
                return;
              }
              if (action === "rewrite") {
                setEditMode("rewrite");
                setDraft(runtime.finalText || claim.text);
                return;
              }
              if (action === "use_source" && claim.source_wording) {
                onCommit("use_source", claim.source_wording);
                return;
              }
              if (action === "delete") {
                onCommit("delete", runtime.finalText || claim.text);
                return;
              }
              onCommit("keep", claim.text);
            }}
            onSearch={() => {
              setShowSearch(true);
              onSearch();
            }}
            onFlag={onFlag}
            onEvidence={onEvidence}
            onSkipEvidence={onSkipEvidence}
            onShowPassages={() => {
              setShowPassages(true);
              onDetail("passage");
            }}
            onShowAlternatives={() => {
              setShowAlternatives(true);
              onAlternatives();
            }}
            onShowSolid={() => {
              setShowSolid(true);
              onDetail("solid_details");
            }}
            onLegend={onLegend}
            onCloseSearch={() => setShowSearch(false)}
          />
        )}
      </div>
    </div>
  );
}

function ClaimBody({
  condition,
  task,
  claim,
  runtime,
  editMode,
  draft,
  showSearch,
  showPassages,
  showAlternatives,
  showSolid,
  onDraft,
  onCancelEdit,
  onSaveEdit,
  onAction,
  onSearch,
  onFlag,
  onEvidence,
  onSkipEvidence,
  onShowPassages,
  onShowAlternatives,
  onShowSolid,
  onLegend,
  onCloseSearch,
}: {
  condition: Condition;
  task: Task;
  claim: DerivedClaim;
  runtime: ClaimRuntime;
  editMode: "hedge" | "rewrite" | null;
  draft: string;
  showSearch: boolean;
  showPassages: boolean;
  showAlternatives: boolean;
  showSolid: boolean;
  onDraft: (value: string) => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onAction: (action: HandlingAction) => void;
  onSearch: () => void;
  onFlag: () => void;
  onEvidence: (evidenceId: string) => void;
  onSkipEvidence: () => void;
  onShowPassages: () => void;
  onShowAlternatives: () => void;
  onShowSolid: () => void;
  onLegend: () => void;
  onCloseSearch: () => void;
}) {
  const required = evidenceIsRequired(condition, claim.quadrant);
  const locked = required && !runtime.handled;
  const matched = claim.evidence_ids
    .map((id) => passageById(task, id))
    .filter((passage): passage is Passage => Boolean(passage));
  const changed = runtime.finalText !== claim.text && runtime.action !== "keep";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 text-sm text-stone-700">
        {runtime.action ? <Status>{actionLabel(runtime.action)}</Status> : <Status>No decision yet</Status>}
        {runtime.flagged ? <Status>Flagged for later</Status> : null}
        {locked ? (
          <Status>
            <IconLock /> Locked
          </Status>
        ) : null}
        {runtime.handled ? <Status>Handled</Status> : null}
      </div>

      <p className={`reading text-stone-900 ${runtime.action === "delete" ? "line-through" : ""}`}>
        {claim.text}
      </p>
      {changed ? (
        <div>
          <p className="text-sm font-medium text-stone-700">Current wording</p>
          <p className={`reading mt-1 text-stone-900 ${runtime.action === "delete" ? "line-through" : ""}`}>
            {runtime.finalText}
          </p>
        </div>
      ) : null}

      {condition === "D" ? (
        <QuadrantLegend current={claim.quadrant} onOpen={onLegend} />
      ) : null}

      {condition === "B" || (condition === "D" && claim.quadrant !== "solid") ? (
        <ConsistencyBar agree={claim.consistency.agree} total={claim.consistency.total} />
      ) : null}

      {condition === "B" ? (
        <Disclosure
          open={showAlternatives}
          onOpen={onShowAlternatives}
          label="Show other samples"
        >
          <Alternatives alternatives={claim.consistency.alternatives} />
        </Disclosure>
      ) : null}

      {condition === "C" || (condition === "D" && claim.quadrant !== "solid") ? (
        <VerdictBadge verdict={claim.verdict} />
      ) : null}

      {condition === "D" ? (
        <QuadrantPanel claim={claim} locked={locked} />
      ) : null}

      {condition === "D" && claim.quadrant === "solid" ? (
        <Disclosure open={showSolid} onOpen={onShowSolid} label="Show consistency and sources">
          <div className="space-y-3">
            <ConsistencyBar agree={claim.consistency.agree} total={claim.consistency.total} />
            <VerdictBadge verdict={claim.verdict} />
            <Alternatives alternatives={claim.consistency.alternatives} />
            <MatchedPassages passages={matched} />
          </div>
        </Disclosure>
      ) : null}

      {condition === "D" && claim.quadrant === "unstable_sourced" && claim.source_wording ? (
        <div className={`rounded-md border px-3 py-3 ${QUADRANT_CHROME.unstable_sourced}`}>
          <p className="flex items-center gap-2 font-medium">
            <QuadrantIcon quadrant="unstable_sourced" />
            A source phrases it this way
          </p>
          <p className="reading mt-2">{claim.source_wording}</p>
        </div>
      ) : null}

      {(condition === "C" || (condition === "D" && claim.quadrant !== "solid")) &&
      claim.verdict !== "NEI" ? (
        <Disclosure open={showPassages} onOpen={onShowPassages} label="Show the matched source passage">
          <MatchedPassages passages={matched} />
        </Disclosure>
      ) : null}

      {(condition === "C" || (condition === "D" && claim.quadrant !== "solid")) &&
      claim.verdict === "NEI" ? (
        <p className="text-sm text-stone-800">
          No passage in this answer’s sources is matched to this claim. {verdictDetail("NEI")}.
        </p>
      ) : null}

      {condition === "D" && claim.quadrant !== "solid" ? (
        <Disclosure
          open={showAlternatives}
          onOpen={onShowAlternatives}
          label="Show other samples"
        >
          <Alternatives alternatives={claim.consistency.alternatives} />
        </Disclosure>
      ) : null}

      {editMode ? (
        <div>
          <label className="block text-sm font-medium text-stone-800" htmlFor="claim-edit">
            {editMode === "hedge" ? "Edit the hedged claim" : "Rewrite the claim"}
          </label>
          <textarea
            id="claim-edit"
            value={draft}
            onChange={(event) => onDraft(event.target.value)}
            rows={5}
            className="reading mt-2 w-full rounded-md border border-stone-400 bg-white px-3 py-2 text-stone-900"
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onSaveEdit}
              disabled={!draft.trim()}
              className="rounded-md border border-stone-900 bg-stone-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Save wording
            </button>
            <button
              type="button"
              onClick={onCancelEdit}
              className="rounded-md border border-stone-400 bg-white px-3 py-2 text-sm font-medium text-stone-900"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <ActionBar
          condition={condition}
          quadrant={claim.quadrant}
          verdict={claim.verdict}
          hasSourceWording={Boolean(claim.source_wording)}
          flagged={runtime.flagged}
          onAction={onAction}
          onSearch={onSearch}
          onFlag={onFlag}
        />
      )}

      <p className="text-sm text-stone-600">
        Flagging or searching does not count as a decision. Keep, delete, hedge, rewrite, or use
        the source wording.
      </p>

      {runtime.evidencePromptOpen ? (
        <EvidenceStep
          claimId={claim.id}
          required={required}
          passages={task.passages}
          extraPassages={task.extra_passages}
          showExtra={runtime.searchOpened}
          onConfirm={onEvidence}
          onSkip={onSkipEvidence}
        />
      ) : null}

      {showSearch ? (
        <SearchPanel passages={task.extra_passages} onClose={onCloseSearch} />
      ) : null}
    </div>
  );
}

function QuadrantPanel({ claim, locked }: { claim: DerivedClaim; locked: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-3 ${QUADRANT_CHROME[claim.quadrant]}`}>
      <p className="flex items-start gap-2 font-medium">
        <QuadrantIcon quadrant={claim.quadrant} />
        <span>{QUADRANT_LABEL[claim.quadrant]}</span>
      </p>
      {claim.quadrant === "confidently_wrong" ? (
        <p className="mt-2 text-sm">
          {locked ? (
            <>
              <span className="inline-flex items-center gap-1 font-medium">
                <IconLock /> Locked.{" "}
              </span>
              This claim counts as handled only after you choose an action and select a source
              passage, or choose “No source covers this”. {verdictDetail(claim.verdict)}.
            </>
          ) : (
            <>Handled. {verdictDetail(claim.verdict)}.</>
          )}
        </p>
      ) : null}
      {claim.quadrant === "speculation" ? (
        <p className="mt-2 text-sm">{suggestionCopy(claim.verdict)}</p>
      ) : null}
      {claim.quadrant === "solid" ? (
        <p className="mt-2 text-sm">No extra step. Open the details if you want them.</p>
      ) : null}
    </div>
  );
}

function Disclosure({
  open,
  onOpen,
  label,
  children,
}: {
  open: boolean;
  onOpen: () => void;
  label: string;
  children: ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-md border border-stone-400 bg-white px-3 py-2 text-left text-sm font-medium text-stone-900"
      >
        {label}
      </button>
    );
  }
  return <div className="space-y-2">{children}</div>;
}

function Alternatives({ alternatives }: { alternatives: string[] }) {
  if (alternatives.length === 0) {
    return <p className="text-sm text-stone-700">No alternate values in the other samples.</p>;
  }
  return (
    <div>
      <p className="text-sm font-medium text-stone-800">Other samples said</p>
      <ul className="mt-1 list-disc pl-5 text-stone-800">
        {alternatives.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function MatchedPassages({ passages }: { passages: Passage[] }) {
  if (passages.length === 0) {
    return <p className="text-sm text-stone-700">No matched passage.</p>;
  }
  return (
    <div className="space-y-3">
      {passages.map((passage) => (
        <blockquote key={passage.id} className="border-l-2 border-stone-400 pl-3">
          <p className="text-sm font-medium text-stone-800">{passage.source_title}</p>
          <p className="reading mt-1 text-stone-900">{passage.text}</p>
        </blockquote>
      ))}
    </div>
  );
}

function PassageCard({
  passage,
  heading,
  onClose,
}: {
  passage: Passage;
  heading: string;
  onClose: () => void;
}) {
  return (
    <section className="rounded-md border border-stone-300 bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-medium tracking-wide text-stone-600 uppercase">{heading}</h3>
        <button type="button" onClick={onClose} className="text-sm font-medium text-stone-800 underline">
          Close
        </button>
      </div>
      <p className="mt-2 font-medium text-stone-900">{passage.source_title}</p>
      <p className="reading mt-1 text-stone-800">{passage.text}</p>
    </section>
  );
}

function Status({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-stone-300 bg-white px-2 py-0.5">
      {children}
    </span>
  );
}
