import { useEffect, useId, useRef, useState } from "react";
import type { Claim, Condition, Scenario, Verdict } from "../types.ts";
import { allPassages } from "../lib/data.ts";
import { quadrantOf } from "../lib/marks.ts";
import {
  barParts,
  passageForValue,
  quadrantLabel,
  sortClaims,
  visibleBranches,
  type BarParts,
} from "../lib/signals.ts";
import { prefersReducedMotion } from "../lib/text.ts";
import { useStudy } from "../store/useStudy.ts";

export function SourceGlyph({ verdict }: { verdict: Verdict }) {
  if (verdict === "NEI") {
    return (
      <svg className="src-glyph" viewBox="0 0 12 12" aria-hidden="true">
        <circle cx="6" cy="6" r="4.2" fill="none" stroke="var(--src-none)" strokeWidth="1.6" />
      </svg>
    );
  }
  const support = verdict === "SUPPORTED";
  return (
    <svg className="src-glyph" viewBox="0 0 12 12" aria-hidden="true">
      <circle cx="6" cy="6" r="5" fill={support ? "var(--src-support)" : "var(--src-refute)"} />
      {support ? (
        <path d="M3.2 6.2 5.1 8 8.8 4.2" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M4 4 8 8 M8 4 4 8" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
      )}
    </svg>
  );
}

export function MicroBar({ parts }: { parts: BarParts }) {
  return (
    <span className="micro-bar" aria-hidden="true">
      {parts.agree > 0 ? <i style={{ flex: parts.agree, background: "var(--agree)" }} /> : null}
      {parts.disagree > 0 ? (
        <i style={{ flex: parts.disagree, background: "var(--disagree)" }} />
      ) : null}
      {parts.absent > 0 ? <i style={{ flex: parts.absent, background: "var(--absent)" }} /> : null}
    </span>
  );
}

function CountBar({ count, total, answer }: { count: number; total: number; answer: boolean }) {
  const width = total > 0 ? (count / total) * 100 : 0;
  return (
    <span className="count-track" aria-hidden="true">
      <i
        style={{
          width: `${width}%`,
          background: answer ? "var(--agree)" : "var(--disagree)",
        }}
      />
    </span>
  );
}

function Highlighted({ text, needle, kind }: { text: string; needle: string; kind: "support" | "refute" }) {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className={kind === "support" ? "hl-support" : "hl-refute"}>
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

export function BranchView({
  scenario,
  claim,
  condition,
  messageId,
  onAsk,
}: {
  scenario: Scenario;
  claim: Claim;
  condition: Condition;
  messageId: string;
  onAsk: () => void;
}) {
  const closeBranch = useStudy((state) => state.closeBranch);
  const selectBranch = useStudy((state) => state.selectBranch);
  const openBranchPassage = useStudy((state) => state.openBranchPassage);
  const passageValue = useStudy((state) =>
    state.openBranch?.messageId === messageId && state.openBranch.claimId === claim.id
      ? state.openBranch.passageValue
      : undefined,
  );
  const listRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [expanded, setExpanded] = useState(false);
  const { rows, hidden } = visibleBranches(claim, expanded);
  const parts = barParts(claim);
  const passages = allPassages(scenario);
  const showSources = condition === "D";
  const passage = passageValue
    ? passageForValue(claim, passages, passageValue)
    : undefined;
  const passageBranch = claim.branches.find((branch) => branch.value === passageValue);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeBranch();
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      const buttons = [
        ...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-branch]") ?? []),
      ];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      if (index < 0) return;
      event.preventDefault();
      const next = event.key === "ArrowDown" ? index + 1 : index - 1;
      buttons[Math.max(0, Math.min(buttons.length - 1, next))]?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [closeBranch]);

  return (
    <div className="branch-view" role="region" aria-label={`Answers for ${claim.key_span}`}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-xs text-stone-500">
          {parts.agree} of {parts.total} answers said “{claim.key_span}”
        </p>
        <button ref={closeRef} type="button" className="text-xs text-stone-600" onClick={closeBranch}>
          Close
        </button>
      </div>
      <div ref={listRef} role="list" className="branch-list">
        {rows.map((branch) => {
          const answer = branch.value === claim.key_span;
          const passageFor = branch.source ? passageForValue(claim, passages, branch.value) : undefined;
          return (
            <div key={branch.value} role="listitem" className="branch-row">
              <svg className="branch-join" viewBox="0 0 24 28" aria-hidden="true">
                <path d="M8 0 V28" />
                <path d="M8 14 C 14 14, 16 14, 24 14" />
              </svg>
              <button
                type="button"
                data-branch=""
                className="bare branch-value"
                onClick={() => selectBranch(messageId, claim.id, branch.value)}
              >
                {branch.value}
              </button>
              <CountBar count={branch.count} total={parts.total} answer={answer} />
              <span className="branch-count">{branch.count}</span>
              {showSources && branch.source && passageFor ? (
                <button
                  type="button"
                  className="bare branch-source"
                  aria-label={`${branch.source === "support" ? "Source supports" : "Source contradicts"} ${branch.value}. Open ${passageFor.source_title}`}
                  onClick={() => openBranchPassage(messageId, claim.id, branch.value)}
                >
                  <SourceGlyph verdict={branch.source === "support" ? "SUPPORTED" : "REFUTED"} />
                  <span>source: {passageFor.source_title}</span>
                </button>
              ) : (
                <span className="branch-note">{answer ? "(AI's answer)" : ""}</span>
              )}
              {showSources && branch.source && answer ? (
                <span className="branch-note">(AI's answer)</span>
              ) : null}
            </div>
          );
        })}
      </div>
      {hidden > 0 ? (
        <button type="button" className="mt-1 text-xs underline" onClick={() => setExpanded(true)}>
          +{hidden} more
        </button>
      ) : null}
      {passage && passageBranch?.source ? (
        <div className="branch-passage">
          <p className="text-xs font-medium text-stone-500">{passage.source_title}</p>
          <p>
            <Highlighted
              text={passage.text}
              needle={passageValue ?? ""}
              kind={passageBranch.source}
            />
          </p>
        </div>
      ) : null}
      {quadrantOf(claim) !== "solid" ? (
        <button type="button" className="chip mt-2" onClick={onAsk}>
          Ask about this
        </button>
      ) : null}
    </div>
  );
}

function stripLine(claims: Claim[]): string {
  const disputed = claims.filter((claim) => quadrantOf(claim) === "confidently_wrong").length;
  const unconfirmed = claims.filter((claim) => claim.verdict === "NEI").length;
  const bits = [`${claims.length} check${claims.length === 1 ? "" : "s"}`];
  if (disputed > 0) bits.push(`${disputed} strongly disputed`);
  if (unconfirmed > 0) bits.push(`${unconfirmed} unconfirmed`);
  return bits.join(" · ");
}

export function SummaryStrip({
  scenario,
  messageId,
  claimIds,
  condition,
}: {
  scenario: Scenario;
  messageId: string;
  claimIds: string[];
  condition: Condition;
}) {
  const expandStrip = useStudy((state) => state.expandStrip);
  const clickStripRow = useStudy((state) => state.clickStripRow);
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const claims = sortClaims(
    claimIds
      .map((id) => scenario.claims.find((claim) => claim.id === id))
      .filter((claim): claim is Claim => Boolean(claim)),
  );
  if (claims.length === 0) return null;

  return (
    <div className="summary-strip mark-in">
      <button
        type="button"
        className="bare summary-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((value) => {
            if (!value) expandStrip(messageId);
            return !value;
          });
        }}
      >
        <span>{stripLine(claims)}</span>
        <span aria-hidden="true">{open ? "▴" : "▾"}</span>
      </button>
      {open ? (
        <div id={panelId} className="summary-rows">
          {claims.map((claim) => {
            const parts = barParts(claim);
            return (
              <button
                key={claim.id}
                type="button"
                className="bare summary-row"
                onClick={() => {
                  clickStripRow(messageId, claim.id);
                  window.setTimeout(() => {
                    document.getElementById(`claim-${messageId}-${claim.id}`)?.scrollIntoView({
                      behavior: prefersReducedMotion() ? "auto" : "smooth",
                      block: "center",
                    });
                  }, 0);
                }}
              >
                <MicroBar parts={parts} />
                <span className="summary-count">
                  {parts.agree}/{parts.disagree}/{parts.absent}
                </span>
                {condition === "C" || condition === "D" ? (
                  <SourceGlyph verdict={claim.verdict} />
                ) : null}
                <span className="summary-label">{claim.key_span}</span>
                {condition === "D" ? (
                  <span className="summary-quadrant">{quadrantLabel(claim)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
