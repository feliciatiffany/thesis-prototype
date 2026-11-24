import { useEffect, useId, useRef } from "react";
import type { Claim, Condition, Scenario } from "../types.ts";
import { askLabel } from "../lib/data.ts";
import {
  claimIsTappable,
  confidentlyWrongNote,
  doubtSentence,
  markStyle,
  passagesFor,
  quadrantOf,
  verdictWords,
  type MarkStyle,
} from "../lib/marks.ts";
import { barParts, showsMicroBar, showsSourceGlyph, splitKey } from "../lib/signals.ts";
import { prefersReducedMotion } from "../lib/text.ts";
import { useStudy } from "../store/useStudy.ts";
import { DotsIcon, SourceIcon, WarningIcon } from "./Icons.tsx";
import { BranchView, MicroBar, SourceGlyph } from "./Signals.tsx";

function underlineClass(style: MarkStyle): string {
  if (style === "dots") return "mark-dots";
  if (style === "amber") return "mark-amber";
  if (style === "line") return "mark-line";
  return "";
}

export function ClaimSpan({
  scenario,
  claim,
  text,
  condition,
  messageId,
  marksVisible,
  isFirst,
  seenEarlier,
}: {
  scenario: Scenario;
  claim: Claim;
  text: string;
  condition: Condition;
  messageId: string;
  marksVisible: boolean;
  isFirst: boolean;
  seenEarlier: boolean;
}) {
  const descId = useId();
  const openMark = useStudy((state) => state.openMark);
  const openBranch = useStudy((state) => state.openBranch);
  const showAllSignals = useStudy((state) => state.showAllSignals);
  const openClaim = useStudy((state) => state.openClaim);
  const closeClaim = useStudy((state) => state.closeClaim);
  const hoverClaim = useStudy((state) => state.hoverClaim);
  const toggleBranch = useStudy((state) => state.toggleBranch);
  const hoverBar = useStudy((state) => state.hoverBar);
  const closeBranch = useStudy((state) => state.closeBranch);
  const setDraft = useStudy((state) => state.setDraft);
  const style = marksVisible ? markStyle(condition, claim) : "none";
  const tappable = marksVisible && claimIsTappable(condition, claim);
  const open =
    openMark?.messageId === messageId && openMark.claimId === claim.id && tappable;
  const branchOpen =
    openBranch?.messageId === messageId && openBranch.claimId === claim.id;
  const anchor = isFirst ? `first-${scenario.id}-${claim.id}` : undefined;
  const doubt = doubtSentence(condition, claim);
  const showCarry = marksVisible && seenEarlier && style !== "none";
  const showBar = marksVisible && showsMicroBar();
  const showGlyph = marksVisible && showsSourceGlyph(condition, claim, showAllSignals);
  const split = marksVisible ? splitKey(text, claim.key_span) : null;
  const parts = barParts(claim);
  const line = underlineClass(style);

  const onOpen = () => {
    if (open) closeClaim();
    else {
      closeBranch();
      openClaim(messageId, claim.id);
    }
  };

  const onKey = () => {
    hoverBar(messageId, claim.id);
    toggleBranch(messageId, claim.id);
  };

  const ask = () => {
    setDraft(askLabel(scenario, claim.id, condition));
    closeClaim();
    closeBranch();
    window.setTimeout(() => document.getElementById("composer")?.focus(), 0);
  };

  const piece = (value: string, key: string) => {
    if (!value) return null;
    if (style === "note" || !tappable || !/[0-9A-Za-z]/.test(value)) {
      return (
        <span key={key} className={line}>
          {value}
        </span>
      );
    }
    // A button is inline-block, so spaces at its edges collapse away.
    // Keep them outside the button so "in 1889" doesn't render as "in1889".
    const [, lead, core, trail] = value.match(/^(\s*)([\s\S]*?)(\s*)$/)!;
    return (
      <span key={key}>
        {lead ? <span className={line}>{lead}</span> : null}
        <button
          type="button"
          className={`bare cursor-pointer rounded-sm ${line}`}
          aria-describedby={descId}
          onMouseEnter={() => {
            if (style !== "none") hoverClaim(messageId, claim.id);
          }}
          onClick={onOpen}
        >
          {core}
        </button>
        {trail ? <span className={line}>{trail}</span> : null}
      </span>
    );
  };

  return (
    <>
      <span className="claim-inline" id={`claim-${messageId}-${claim.id}`}>
      {anchor ? <span id={anchor} /> : null}
      {split && (showBar || showGlyph) ? (
        <>
          {piece(split.before, "before")}
          <button
            type="button"
            className="key-hit bare"
            aria-describedby={descId}
            aria-expanded={branchOpen}
            aria-label={`${split.key}. ${parts.agree} of ${parts.total} answers said this. ${showGlyph ? verdictWords(claim.verdict) : ""}`}
            onMouseEnter={() => {
              if (showBar) hoverBar(messageId, claim.id);
              if (style !== "none") hoverClaim(messageId, claim.id);
            }}
            onFocus={() => {
              if (showBar) hoverBar(messageId, claim.id);
            }}
            onClick={onKey}
          >
            {showBar ? <MicroBar parts={parts} /> : null}
            <span className={line}>{split.key}</span>
            {showGlyph ? <SourceGlyph verdict={claim.verdict} /> : null}
          </button>
          {piece(split.after, "after")}
          {style === "dots" ? <DotsIcon /> : null}
          {style === "line" ? <SourceIcon /> : null}
          {style === "amber" ? (
            <span className="ml-0.5 font-semibold" aria-hidden="true">
              ?
            </span>
          ) : null}
        </>
      ) : style === "note" ? (
        <span aria-describedby={descId}>{text}</span>
      ) : tappable ? (
        <button
          type="button"
          id={`mark-${messageId}-${claim.id}`}
          className={`bare cursor-pointer rounded-sm ${line}`}
          aria-describedby={descId}
          aria-expanded={open}
          onMouseEnter={() => {
            if (style !== "none") hoverClaim(messageId, claim.id);
          }}
          onClick={onOpen}
        >
          {text}
          {style === "dots" ? <DotsIcon /> : null}
          {style === "line" ? <SourceIcon /> : null}
          {style === "amber" ? (
            <span className="ml-0.5 font-semibold" aria-hidden="true">
              ?
            </span>
          ) : null}
        </button>
      ) : (
        <span id={`claim-${messageId}-${claim.id}`}>{text}</span>
      )}
      {style === "note" ? (
        <button
          type="button"
          id={`mark-${messageId}-${claim.id}`}
          className="note-pill mark-in bare"
          aria-describedby={descId}
          aria-expanded={open}
          onMouseEnter={() => hoverClaim(messageId, claim.id)}
          onClick={onOpen}
        >
          <WarningIcon />
          <span>{confidentlyWrongNote(claim)}</span>
        </button>
      ) : null}
      <span id={descId} className="sr-only">
        {tappable ? doubt : ""}
      </span>
      {showCarry ? (
        <button
          type="button"
          className="bare ml-1 cursor-pointer text-xs text-stone-600 underline decoration-stone-300 underline-offset-2"
          onClick={() => {
            document.getElementById(`first-${scenario.id}-${claim.id}`)?.scrollIntoView({
              behavior: prefersReducedMotion() ? "auto" : "smooth",
              block: "center",
            });
          }}
        >
          flagged earlier ↑
        </button>
      ) : null}
      </span>
      {branchOpen ? (
        <BranchView
          scenario={scenario}
          claim={claim}
          condition={condition}
          messageId={messageId}
          onAsk={ask}
        />
      ) : null}
      {open && !branchOpen ? (
        <ClaimPopover
          scenario={scenario}
          claim={claim}
          condition={condition}
          doubt={doubt}
          onClose={closeClaim}
          onAsk={ask}
        />
      ) : null}
    </>
  );
}

function ClaimPopover({
  scenario,
  claim,
  condition,
  doubt,
  onClose,
  onAsk,
}: {
  scenario: Scenario;
  claim: Claim;
  condition: Condition;
  doubt: string;
  onClose: () => void;
  onAsk: () => void;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const passages = passagesFor(claim, [...scenario.passages, ...scenario.extra_passages]);
  const showSources = condition === "C" || condition === "D";
  const quadrant = quadrantOf(claim);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      previous?.focus();
    };
  }, [onClose]);

  return (
    <span
      ref={ref}
      role="dialog"
      aria-label="About this sentence"
      className="popover"
    >
      <span className="mb-2 flex items-start justify-between gap-3">
        <span className="block">{doubt}</span>
        <button
          ref={closeRef}
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-xs text-stone-600"
          onClick={onClose}
        >
          Close
        </button>
      </span>
      {showSources && passages.length === 0 ? (
        <span className="mb-2 block text-stone-600">
          No passage in the provided pages covers this sentence.
        </span>
      ) : null}
      {showSources
        ? passages.map((passage) => (
            <span key={passage.id} className="mb-2 block rounded-lg bg-stone-50 p-2">
              <span className="mb-1 block text-xs font-medium text-stone-500">
                {passage.source_title}
              </span>
              {passage.text}
            </span>
          ))
        : null}
      {quadrant !== "solid" ? (
        <button
          type="button"
          className="chip"
          onClick={onAsk}
        >
          Ask about this
        </button>
      ) : null}
    </span>
  );
}
