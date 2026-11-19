import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { MIN_USER_TURNS } from "../config.ts";
import { tutorialScenario, tutorialTips } from "../data/tutorial.ts";
import { allPassages, scenarioById, visibleChips } from "../lib/data.ts";
import { nodeById, segmentText } from "../lib/text.ts";
import { useStudy } from "../store/useStudy.ts";
import type { Scenario, Segment } from "../types.ts";
import { ClaimSpan } from "./ClaimSpan.tsx";
import { RestartButton } from "./RestartButton.tsx";
import { DecisionDialog } from "./DecisionDialog.tsx";
import { Explainer } from "./Explainer.tsx";
import { SummaryStrip } from "./Signals.tsx";

export function ChatView({ practice = false }: { practice?: boolean }) {
  const phase = useStudy((state) => state.phase);
  const order = useStudy((state) => state.scenarioOrder);
  const index = useStudy((state) => state.scenarioIndex);
  const conditions = useStudy((state) => state.scenarioConditions);
  const messages = useStudy((state) => state.messages);
  const draft = useStudy((state) => state.draft);
  const setDraft = useStudy((state) => state.setDraft);
  const sendText = useStudy((state) => state.sendText);
  const sendChip = useStudy((state) => state.sendChip);
  const bootActive = useStudy((state) => state.bootActive);
  const openDecision = useStudy((state) => state.openDecision);
  const finishTutorial = useStudy((state) => state.finishTutorial);
  const sourcePopover = useStudy((state) => state.sourcePopover);
  const openSource = useStudy((state) => state.openSource);
  const closeSource = useStudy((state) => state.closeSource);
  const openExplainer = useStudy((state) => state.openExplainer);
  const showAllSignals = useStudy((state) => state.showAllSignals);
  const toggleSignals = useStudy((state) => state.toggleSignals);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scenarioId = practice ? "tutorial" : (order[index] ?? "");
  const condition = conditions[index] ?? "A";
  const scenario = practice ? tutorialScenario : scenarioById(scenarioId);
  const visible = messages.filter((message) => message.scenarioId === scenarioId);
  const latest = [...visible].reverse().find((message) => message.role === "assistant");
  const busy = visible.some(
    (message) => message.role === "assistant" && message.status !== "settled",
  );
  const turns = visible.filter((message) => message.role === "user").length;
  const node = scenario && latest?.nodeId ? nodeById(scenario, latest.nodeId) : undefined;
  const chips =
    scenario && node && latest?.status === "settled"
      ? visibleChips(node, condition).filter((chip) => chip.condition !== "D" || latest.marksVisible)
      : [];
  const practiceDone = visible.some(
    (message) => message.nodeId === "t_n3" && message.status === "settled" && message.marksVisible,
  );
  const tip =
    practice && condition !== "A" ? tutorialTips[condition][latest?.nodeId ?? ""] : "";

  useEffect(() => {
    bootActive();
  }, [bootActive, scenarioId, phase]);

  const scrollKey = `${latest?.id ?? ""}:${latest?.shownChars ?? 0}:${latest?.marksVisible ?? false}:${visible.length}`;
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [scrollKey]);

  const seen = useMemo(() => {
    const prior = new Map<string, Set<string>>();
    const running = new Set<string>();
    if (!scenario) return prior;
    for (const message of visible) {
      prior.set(message.id, new Set(running));
      const messageNode = message.nodeId ? nodeById(scenario, message.nodeId) : undefined;
      for (const segment of messageNode?.segments ?? []) {
        if (segment.kind === "claim") running.add(segment.claim_id);
      }
    }
    return prior;
  }, [scenario, visible]);

  if (!scenario) {
    return (
      <Shell title="Chat">
        <p className="p-4">This scenario is missing from the file.</p>
      </Shell>
    );
  }

  return (
    <Shell
      title={practice ? "Practice" : `Part ${index + 1} of ${order.length}`}
      onExplainer={condition === "D" ? openExplainer : undefined}
      signals={
        condition === "D" ? { on: showAllSignals, toggle: toggleSignals } : undefined
      }
    >
      {practice ? (
        <p className="brief">{tip || tutorialScenario.brief}</p>
      ) : (
        <p className="brief">{scenario.brief}</p>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <div className="space-y-6">
          {visible.map((message) =>
            message.role === "user" ? (
              <p key={message.id} className="user-bubble">
                {message.userText}
              </p>
            ) : (
              <AssistantMessage
                key={message.id}
                scenario={scenario}
                messageId={message.id}
                nodeId={message.nodeId}
                status={message.status}
                shownChars={message.shownChars}
                marksVisible={message.marksVisible}
                condition={condition}
                seenEarlier={seen.get(message.id) ?? new Set()}
                sourceOpen={
                  sourcePopover?.messageId === message.id ? sourcePopover.sourceId : null
                }
                onOpenSource={(sourceId) => openSource(sourceId, message.id)}
                onCloseSource={closeSource}
              />
            ),
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <div className="composer-dock">
        {chips.length > 0 ? (
          <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
            {chips.map((chip) => (
              <button
                key={`${chip.goto}-${chip.label}`}
                type="button"
                disabled={busy}
                className="chip"
                onClick={() => sendChip(chip.label, chip.goto)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        ) : null}
        <form
          className="flex items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            sendText(draft);
          }}
        >
          <label className="sr-only" htmlFor="composer">
            Message
          </label>
          <textarea
            id="composer"
            rows={2}
            value={draft}
            disabled={busy}
            placeholder="Message"
            className="composer"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                sendText(draft);
              }
            }}
          />
          <button type="submit" disabled={busy || draft.trim().length === 0} className="send">
            Send
          </button>
        </form>
        {practice ? (
          <button type="button" disabled={!practiceDone} className="decide" onClick={finishTutorial}>
            {practiceDone ? "Continue to the study" : "Continue after the last practice reply"}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy || turns < MIN_USER_TURNS}
            className="decide"
            onClick={openDecision}
          >
            {turns < MIN_USER_TURNS
              ? `I'm ready to decide (${turns} of ${MIN_USER_TURNS} messages)`
              : "I'm ready to decide"}
          </button>
        )}
      </div>
      {phase === "decision" && !practice ? <DecisionDialog /> : null}
      <Explainer />
    </Shell>
  );
}

function AssistantMark() {
  return (
    <span className="avatar" aria-hidden="true">
      <svg viewBox="0 0 16 16" className="h-4 w-4">
        <path
          fill="currentColor"
          d="M8 1.2 9.3 6h4.9L10.4 8.8l1.2 4.8L8 10.8 4.4 13.6 5.6 8.8 1.8 6h4.9L8 1.2Z"
        />
      </svg>
    </span>
  );
}

function Shell({
  title,
  onExplainer,
  signals,
  children,
}: {
  title: string;
  onExplainer?: () => void;
  signals?: { on: boolean; toggle: () => void };
  children: ReactNode;
}) {
  return (
    <div className="chat-shell">
      <header className="chat-header">
        <div className="flex items-center gap-2.5">
          <AssistantMark />
          <div>
            <p className="text-sm font-medium leading-none">Assistant</p>
            <p className="mt-1 text-xs text-stone-500">{title}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
          {signals ? (
            <button
              type="button"
              className="text-sm text-stone-600 underline decoration-stone-300 underline-offset-4"
              aria-pressed={signals.on}
              onClick={signals.toggle}
            >
              {signals.on ? "Showing all signals" : "Show all signals"}
            </button>
          ) : null}
          {onExplainer ? (
            <button type="button" className="text-sm text-stone-600 underline decoration-stone-300 underline-offset-4" onClick={onExplainer}>
              How to read these marks
            </button>
          ) : null}
          <RestartButton />
        </div>
      </header>
      {children}
    </div>
  );
}

function AssistantMessage({
  scenario,
  messageId,
  nodeId,
  status,
  shownChars,
  marksVisible,
  condition,
  seenEarlier,
  sourceOpen,
  onOpenSource,
  onCloseSource,
}: {
  scenario: Scenario;
  messageId: string;
  nodeId?: string;
  status: "thinking" | "streaming" | "settled";
  shownChars: number;
  marksVisible: boolean;
  condition: "A" | "B" | "C" | "D";
  seenEarlier: Set<string>;
  sourceOpen: string | null;
  onOpenSource: (sourceId: string) => void;
  onCloseSource: () => void;
}) {
  const node = nodeId ? nodeById(scenario, nodeId) : undefined;
  if (status === "thinking" || !node) {
    return (
      <div className="flex gap-3">
        <AssistantMark />
        <p className="thinking" role="status">
          <span />
          <span />
          <span />
          <span className="sr-only">The assistant is writing</span>
        </p>
      </div>
    );
  }
  const slices = sliceSegments(node.segments, scenario, shownChars);
  const passages = allPassages(scenario);
  const openPassage = passages.find((passage) => passage.id === sourceOpen);
  return (
    <div className="flex gap-3" aria-busy={status !== "settled"}>
      <AssistantMark />
      <div className="min-w-0 flex-1">
      <div className="leading-relaxed">
        {slices.map((slice, index) => {
          const segment = slice.segment;
          if (segment.kind === "text" || !slice.complete || !marksVisible) {
            return <span key={index}>{slice.text}</span>;
          }
          const found = scenario.claims.find((item) => item.id === segment.claim_id);
          if (!found) return <span key={index}>{slice.text}</span>;
          const earlier = seenEarlier.has(found.id);
          return (
            <ClaimSpan
              key={index}
              scenario={scenario}
              claim={found}
              text={slice.text}
              condition={condition}
              messageId={messageId}
              marksVisible={marksVisible}
              isFirst={!earlier}
              seenEarlier={earlier}
            />
          );
        })}
      </div>
      {status === "settled" && marksVisible ? (
        <SummaryStrip
          scenario={scenario}
          messageId={messageId}
          condition={condition}
          claimIds={node.segments.flatMap((segment) =>
            segment.kind === "claim" ? [segment.claim_id] : [],
          )}
        />
      ) : null}
      {status === "settled" && node.source_ids.length > 0 ? (
        <div className="relative mt-3 flex flex-wrap gap-2">
          {node.source_ids.map((sourceId, index) => {
            const passage = passages.find((item) => item.id === sourceId);
            return (
              <button
                key={sourceId}
                type="button"
                id={`source-${messageId}-${sourceId}`}
                className="source-chip"
                aria-expanded={sourceOpen === sourceId}
                onClick={() =>
                  sourceOpen === sourceId ? onCloseSource() : onOpenSource(sourceId)
                }
              >
                {index + 1}. {passage?.source_title ?? "Source"}
              </button>
            );
          })}
          {openPassage ? (
            <SourcePopover
              title={openPassage.source_title}
              text={openPassage.text}
              onClose={onCloseSource}
            />
          ) : null}
        </div>
      ) : null}
      </div>
    </div>
  );
}

function sliceSegments(segments: Segment[], scenario: Scenario, shownChars: number) {
  let remaining = shownChars;
  const slices: { segment: Segment; text: string; complete: boolean }[] = [];
  for (const segment of segments) {
    if (remaining <= 0) break;
    const full = segmentText(segment, scenario);
    const text = full.slice(0, remaining);
    remaining -= text.length;
    slices.push({ segment, text, complete: text.length === full.length });
  }
  return slices;
}

function SourcePopover({
  title,
  text,
  onClose,
}: {
  title: string;
  text: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
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
    <div
      ref={ref}
      role="dialog"
      aria-label={title}
      className="popover"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-stone-500">{title}</p>
        <button ref={closeRef} type="button" className="text-xs text-stone-600" onClick={onClose}>
          Close
        </button>
      </div>
      <p>{text}</p>
    </div>
  );
}
