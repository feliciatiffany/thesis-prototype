import { create } from "zustand";
import {
  ANNOTATION_DELAY_MS,
  STREAM_CHARS,
  STREAM_TICK_MS,
  THINKING_MS,
} from "../config.ts";
import { tutorialScenario } from "../data/tutorial.ts";
import {
  conditionFromPid,
  latinSquareOrder,
  pilotPlan,
  readDelay,
  readStudyParams,
} from "../lib/assignment.ts";
import { scenarioById, scenarios } from "../lib/data.ts";
import { showsDoubtMark } from "../lib/marks.ts";
import { computeQuadrant } from "../lib/quadrant.ts";
import { matchIntent } from "../lib/routing.ts";
import { clearStudy, loadStudy, saveStudy } from "../lib/storage.ts";
import { claimById, nodeById, nodePlainText, prefersReducedMotion } from "../lib/text.ts";
import type {
  BeliefAnswer,
  Condition,
  LogEvent,
  QuestionnaireRecord,
  RouteTrace,
  Scenario,
  StudyData,
  UiMessage,
} from "../types.ts";

const timers = new Set<number>();

function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id);
    fn();
  }, ms);
  timers.add(id);
}

export function cancelStudyTimers() {
  for (const id of timers) window.clearTimeout(id);
  timers.clear();
}

function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function blank(): StudyData {
  return {
    version: 1,
    pid: "",
    started: false,
    phase: "consent",
    mode: "standard",
    sessionCondition: "A",
    assignedFromHash: false,
    scenarioOrder: [],
    scenarioConditions: [],
    scenarioIndex: 0,
    delayMs: ANNOTATION_DELAY_MS,
    tutorialsSeen: [],
    messages: [],
    events: [],
    scenarioStartedAt: null,
    decisions: [],
    questionnaires: [],
    lastRoute: null,
    explainerOpen: false,
    booted: [],
  };
}

function hydrate(data: StudyData): StudyData {
  return {
    ...data,
    messages: data.messages.map((message) => {
      if (message.role === "user" || (message.status === "settled" && message.marksVisible)) {
        return message;
      }
      return {
        ...message,
        status: "settled",
        shownChars: Number.MAX_SAFE_INTEGER,
        marksVisible: message.marksVisible,
      };
    }),
  };
}

function activeCondition(state: StudyData): Condition {
  return state.scenarioConditions[state.scenarioIndex] ?? "A";
}

function activeScenarioId(state: StudyData): string {
  if (state.phase === "tutorial") return "tutorial";
  return state.scenarioOrder[state.scenarioIndex] ?? "";
}

function contentFor(scenarioId: string): Scenario | undefined {
  if (scenarioId === "tutorial") return tutorialScenario;
  return scenarioById(scenarioId);
}

function appendEvent(
  state: StudyData,
  event: {
    type: LogEvent["type"];
    scenario_id?: string;
    node_id?: string;
    claim_id?: string;
    payload: Record<string, unknown>;
  },
): StudyData {
  const scenarioId = event.scenario_id ?? activeScenarioId(state);
  const entry: LogEvent = {
    pid: state.pid,
    condition: activeCondition(state),
    scenario_id: scenarioId,
    node_id: event.node_id,
    claim_id: event.claim_id,
    type: event.type,
    payload: event.payload,
    t: state.scenarioStartedAt ? Date.now() - state.scenarioStartedAt : 0,
    ts: new Date().toISOString(),
  };
  return { ...state, events: [...state.events, entry] };
}

function isBusy(state: StudyData, scenarioId: string): boolean {
  return state.messages.some(
    (message) =>
      message.scenarioId === scenarioId &&
      message.role === "assistant" &&
      message.status !== "settled",
  );
}

function addUser(state: StudyData, scenarioId: string, text: string): StudyData {
  const message: UiMessage = {
    id: uid("u"),
    role: "user",
    scenarioId,
    userText: text,
    status: "settled",
    shownChars: text.length,
    marksVisible: true,
  };
  return { ...state, messages: [...state.messages, message] };
}

function revealMarks(messageId: string) {
  useStudy.setState((state) => {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message || message.marksVisible) return state;
    const scenario = contentFor(message.scenarioId);
    const node =
      scenario && message.nodeId ? nodeById(scenario, message.nodeId) : undefined;
    let next: StudyData = {
      ...state,
      messages: state.messages.map((item) =>
        item.id === messageId ? { ...item, marksVisible: true } : item,
      ),
    };
    if (!scenario || !node) return next;
    const condition = activeCondition(state);
    for (const segment of node.segments) {
      if (segment.kind !== "claim") continue;
      const claim = claimById(scenario, segment.claim_id);
      if (!claim || !showsDoubtMark(condition, claim)) continue;
      next = appendEvent(next, {
        type: "mark_visible",
        scenario_id: message.scenarioId,
        node_id: node.id,
        claim_id: claim.id,
        payload: {
          message_id: messageId,
          quadrant: computeQuadrant(claim),
          verdict: claim.verdict,
        },
      });
    }
    return next;
  });
}

function streamMessage(messageId: string, total: number, index: number) {
  const shown = Math.min(total, index + STREAM_CHARS);
  const done = shown >= total;
  let missing = false;
  useStudy.setState((state) => {
    const message = state.messages.find((item) => item.id === messageId);
    if (!message || message.status === "settled") {
      missing = true;
      return state;
    }
    return {
      messages: state.messages.map((item) =>
        item.id === messageId
          ? { ...item, status: done ? "settled" : "streaming", shownChars: shown }
          : item,
      ),
    };
  });
  if (missing) return;
  if (done) later(() => revealMarks(messageId), useStudy.getState().delayMs);
  else later(() => streamMessage(messageId, total, shown), STREAM_TICK_MS);
}

function queueAssistant(
  state: StudyData,
  scenario: Scenario,
  nodeId: string,
  scenarioId: string,
): StudyData {
  const node = nodeById(scenario, nodeId) ?? nodeById(scenario, scenario.fallback_node);
  if (!node) return state;
  const id = uid("a");
  const message: UiMessage = {
    id,
    role: "assistant",
    scenarioId,
    nodeId: node.id,
    status: "thinking",
    shownChars: 0,
    marksVisible: false,
  };
  let next: StudyData = {
    ...state,
    messages: [...state.messages, message],
    scenarioStartedAt: state.scenarioStartedAt ?? Date.now(),
    explainerOpen: false,
  };
  const alreadyStarted = state.events.some(
    (event) => event.type === "scenario_start" && event.scenario_id === scenarioId,
  );
  if (!alreadyStarted) {
    next = appendEvent(next, {
      type: "scenario_start",
      scenario_id: scenarioId,
      node_id: node.id,
      payload: { delay_ms: state.delayMs },
    });
  }
  next = appendEvent(next, {
    type: "message_shown",
    scenario_id: scenarioId,
    node_id: node.id,
    payload: { message_id: id },
  });
  const total = nodePlainText(scenario, node).length;
  later(() => {
    const current = useStudy.getState().messages.find((item) => item.id === id);
    if (!current || current.status === "settled") return;
    if (prefersReducedMotion()) {
      useStudy.setState((state) => ({
        messages: state.messages.map((item) =>
          item.id === id ? { ...item, status: "settled", shownChars: total } : item,
        ),
      }));
      later(() => revealMarks(id), useStudy.getState().delayMs);
      return;
    }
    useStudy.setState((state) => ({
      messages: state.messages.map((item) =>
        item.id === id && item.status === "thinking" ? { ...item, status: "streaming" } : item,
      ),
    }));
    streamMessage(id, total, 0);
  }, THINKING_MS);
  return next;
}

export interface StudyStore extends StudyData {
  conflictPid: string | null;
  draft: string;
  openMark: { messageId: string; claimId: string } | null;
  sourcePopover: { messageId: string; sourceId: string } | null;
  openBranch: { messageId: string; claimId: string; passageValue?: string } | null;
  showAllSignals: boolean;
  start: (pid: string) => void;
  beginTask: () => void;
  keepSaved: () => void;
  discardSaved: () => void;
  reset: () => void;
  bootActive: () => void;
  sendChip: (label: string, goto: string) => void;
  sendText: (text: string) => void;
  setDraft: (draft: string) => void;
  openClaim: (messageId: string, claimId: string) => void;
  hoverClaim: (messageId: string, claimId: string) => void;
  closeClaim: () => void;
  toggleBranch: (messageId: string, claimId: string) => void;
  selectBranch: (messageId: string, claimId: string, value: string) => void;
  openBranchPassage: (messageId: string, claimId: string, value: string) => void;
  closeBranch: () => void;
  hoverBar: (messageId: string, claimId: string) => void;
  expandStrip: (messageId: string) => void;
  clickStripRow: (messageId: string, claimId: string) => void;
  toggleSignals: () => void;
  openSource: (sourceId: string, messageId: string) => void;
  closeSource: () => void;
  openExplainer: () => void;
  closeExplainer: () => void;
  openDecision: () => void;
  closeDecision: () => void;
  submitDecision: (input: {
    optionId: string;
    reasonClaimIds: string[];
    otherReason: string;
    beliefs: BeliefAnswer[];
  }) => void;
  submitQuestionnaire: (
    input: Omit<QuestionnaireRecord, "scenarioId" | "condition">,
  ) => void;
  finishTutorial: () => void;
}

function pick(state: StudyStore): StudyData {
  return {
    version: state.version,
    pid: state.pid,
    started: state.started,
    phase: state.phase,
    mode: state.mode,
    sessionCondition: state.sessionCondition,
    assignedFromHash: state.assignedFromHash,
    scenarioOrder: state.scenarioOrder,
    scenarioConditions: state.scenarioConditions,
    scenarioIndex: state.scenarioIndex,
    delayMs: state.delayMs,
    tutorialsSeen: state.tutorialsSeen,
    messages: state.messages,
    events: state.events,
    scenarioStartedAt: state.scenarioStartedAt,
    decisions: state.decisions,
    questionnaires: state.questionnaires,
    lastRoute: state.lastRoute,
    explainerOpen: state.explainerOpen,
    booted: state.booted,
  };
}

function buildSession(pid: string): StudyData {
  const params = readStudyParams();
  const delayMs = readDelay(ANNOTATION_DELAY_MS);
  const ids = scenarios.map((scenario) => scenario.id);
  if (params.mode === "pilot") {
    const plan = pilotPlan(pid);
    return {
      ...blank(),
      pid,
      started: true,
      phase: "instructions",
      mode: "pilot",
      sessionCondition: "pilot",
      scenarioOrder: plan.scenarioIds,
      scenarioConditions: plan.conditions,
      delayMs,
    };
  }
  const assignedFromHash = !params.condition;
  const condition = params.condition ?? conditionFromPid(pid);
  return {
    ...blank(),
    pid,
    started: true,
    phase: "instructions",
    mode: "standard",
    sessionCondition: condition,
    assignedFromHash,
    scenarioOrder: latinSquareOrder(pid, ids),
    scenarioConditions: ids.map(() => condition),
    delayMs,
  };
}

const saved = loadStudy();
const urlPid = readStudyParams().pid;
const initial = saved ? hydrate(saved) : blank();

export const useStudy = create<StudyStore>((set, get) => ({
  ...initial,
  conflictPid: saved && urlPid && saved.pid !== urlPid ? urlPid : null,
  draft: "",
  openMark: null, openBranch: null,
  sourcePopover: null,
  showAllSignals: false,

  start: (pid) => {
    const trimmed = pid.trim();
    if (!trimmed || get().started) return;
    cancelStudyTimers();
    set({ ...buildSession(trimmed), conflictPid: null, draft: "", openMark: null, openBranch: null, sourcePopover: null });
  },

  beginTask: () => {
    set((state) => {
      if (state.phase !== "instructions") return state;
      const condition = state.scenarioConditions[state.scenarioIndex] ?? "A";
      return { ...state, phase: condition === "A" ? "chat" : "tutorial" };
    });
  },

  keepSaved: () => set({ conflictPid: null }),

  discardSaved: () => {
    cancelStudyTimers();
    clearStudy();
    const pid = get().conflictPid ?? "";
    set({
      ...blank(),
      conflictPid: null,
      draft: "",
      openMark: null, openBranch: null,
      sourcePopover: null,
    });
    if (pid) get().start(pid);
  },

  reset: () => {
    cancelStudyTimers();
    clearStudy();
    set({
      ...blank(),
      conflictPid: null,
      draft: "",
      openMark: null, openBranch: null,
      sourcePopover: null,
      showAllSignals: false,
    });
  },

  bootActive: () => {
    const state = get();
    const scenarioId = state.phase === "tutorial" ? "tutorial" : state.scenarioOrder[state.scenarioIndex];
    if (!scenarioId || !state.started) return;
    if (state.booted.includes(scenarioId)) return;
    if (state.messages.some((message) => message.scenarioId === scenarioId && message.role === "assistant")) {
      set({ booted: [...state.booted, scenarioId] });
      return;
    }
    const scenario = contentFor(scenarioId);
    if (!scenario) return;
    set((current) => {
      if (current.booted.includes(scenarioId)) return current;
      return queueAssistant(
        { ...current, booted: [...current.booted, scenarioId] },
        scenario,
        scenario.start_node,
        scenarioId,
      );
    });
  },

  sendChip: (label, goto) => {
    set((state) => {
      const scenarioId = activeScenarioId(state);
      const scenario = contentFor(scenarioId);
      if (!scenario || isBusy(state, scenarioId)) return state;
      const node = nodeById(scenario, goto) ?? nodeById(scenario, scenario.fallback_node);
      if (!node) return state;
      let next = addUser(state, scenarioId, label);
      next = appendEvent(next, {
        type: "chip_tap",
        scenario_id: scenarioId,
        node_id: node.id,
        payload: { label, goto: node.id },
      });
      return {
        ...queueAssistant(next, scenario, node.id, scenarioId),
        draft: "",
        openMark: null, openBranch: null,
        sourcePopover: null,
        lastRoute: null,
      };
    });
  },

  sendText: (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    set((state) => {
      const scenarioId = activeScenarioId(state);
      const scenario = contentFor(scenarioId);
      if (!scenario || isBusy(state, scenarioId)) return state;
      const last = [...state.messages]
        .reverse()
        .find((message) => message.scenarioId === scenarioId && message.role === "assistant");
      const current = (last?.nodeId && nodeById(scenario, last.nodeId)) || scenario.nodes[0];
      const matched = current ? matchIntent(trimmed, current.intents) : null;
      const goto = matched?.goto ?? scenario.fallback_node;
      const node = nodeById(scenario, goto) ?? nodeById(scenario, scenario.fallback_node);
      if (!node) return state;
      const route: RouteTrace = {
        input: trimmed,
        goto: node.id,
        matched: Boolean(matched) && node.id !== scenario.fallback_node,
        keyword: matched?.keyword,
      };
      let next = addUser(state, scenarioId, trimmed);
      next = appendEvent(next, {
        type: "free_text",
        scenario_id: scenarioId,
        payload: { text: trimmed },
      });
      if (route.matched) {
        next = appendEvent(next, {
          type: "intent_routed",
          scenario_id: scenarioId,
          node_id: node.id,
          payload: { text: trimmed, goto: node.id, keyword: route.keyword ?? "" },
        });
      } else {
        next = appendEvent(next, {
          type: "fallback_hit",
          scenario_id: scenarioId,
          node_id: node.id,
          payload: { text: trimmed, goto: node.id },
        });
      }
      return {
        ...queueAssistant(next, scenario, node.id, scenarioId),
        draft: "",
        openMark: null, openBranch: null,
        sourcePopover: null,
        lastRoute: route,
      };
    });
  },

  setDraft: (draft) => set({ draft }),

  openClaim: (messageId, claimId) => {
    set((state) => {
      const message = state.messages.find((item) => item.id === messageId);
      const scenario = message ? contentFor(message.scenarioId) : undefined;
      const claim = scenario?.claims.find((item) => item.id === claimId);
      const marked = Boolean(claim && showsDoubtMark(activeCondition(state), claim));
      const opened = {
        ...state,
        openMark: { messageId, claimId },
        sourcePopover: null,
      };
      if (!marked) return opened;
      return {
        ...appendEvent(opened, {
          type: "mark_open",
          scenario_id: message?.scenarioId,
          node_id: message?.nodeId,
          claim_id: claimId,
          payload: { message_id: messageId },
        }),
        openMark: { messageId, claimId },
        sourcePopover: null,
      };
    });
  },

  hoverClaim: (messageId, claimId) => {
    set((state) => {
      const seen = state.events.some(
        (event) =>
          event.type === "mark_hover" &&
          event.claim_id === claimId &&
          event.payload.message_id === messageId,
      );
      if (seen) return state;
      const message = state.messages.find((item) => item.id === messageId);
      return appendEvent(state, {
        type: "mark_hover",
        scenario_id: message?.scenarioId,
        node_id: message?.nodeId,
        claim_id: claimId,
        payload: { message_id: messageId },
      });
    });
  },

  closeClaim: () => set({ openMark: null, openBranch: null }),

  toggleBranch: (messageId, claimId) => {
    set((state) => {
      if (state.openBranch?.messageId === messageId && state.openBranch.claimId === claimId) {
        return { ...state, openBranch: null };
      }
      const message = state.messages.find((item) => item.id === messageId);
      return {
        ...appendEvent(state, {
          type: "branch_open",
          scenario_id: message?.scenarioId,
          node_id: message?.nodeId,
          claim_id: claimId,
          payload: { message_id: messageId },
        }),
        openMark: null,
        sourcePopover: null,
        openBranch: { messageId, claimId },
      };
    });
  },

  selectBranch: (messageId, claimId, value) => {
    set((state) => {
      const message = state.messages.find((item) => item.id === messageId);
      return appendEvent(state, {
        type: "branch_select",
        scenario_id: message?.scenarioId,
        node_id: message?.nodeId,
        claim_id: claimId,
        payload: { message_id: messageId, value },
      });
    });
  },

  openBranchPassage: (messageId, claimId, value) => {
    set((state) => {
      const message = state.messages.find((item) => item.id === messageId);
      return {
        ...appendEvent(state, {
          type: "branch_source_open",
          scenario_id: message?.scenarioId,
          node_id: message?.nodeId,
          claim_id: claimId,
          payload: { message_id: messageId, value },
        }),
        openBranch: { messageId, claimId, passageValue: value },
      };
    });
  },

  closeBranch: () => set({ openBranch: null }),

  hoverBar: (messageId, claimId) => {
    set((state) => {
      const seen = state.events.some(
        (event) =>
          event.type === "bar_hover" &&
          event.claim_id === claimId &&
          event.payload.message_id === messageId,
      );
      if (seen) return state;
      const message = state.messages.find((item) => item.id === messageId);
      return appendEvent(state, {
        type: "bar_hover",
        scenario_id: message?.scenarioId,
        node_id: message?.nodeId,
        claim_id: claimId,
        payload: { message_id: messageId },
      });
    });
  },

  expandStrip: (messageId) => {
    set((state) => {
      const seen = state.events.some(
        (event) => event.type === "strip_expand" && event.payload.message_id === messageId,
      );
      if (seen) return state;
      const message = state.messages.find((item) => item.id === messageId);
      return appendEvent(state, {
        type: "strip_expand",
        scenario_id: message?.scenarioId,
        node_id: message?.nodeId,
        payload: { message_id: messageId },
      });
    });
  },

  clickStripRow: (messageId, claimId) => {
    set((state) => {
      const message = state.messages.find((item) => item.id === messageId);
      const logged = appendEvent(state, {
        type: "strip_row_click",
        scenario_id: message?.scenarioId,
        node_id: message?.nodeId,
        claim_id: claimId,
        payload: { message_id: messageId },
      });
      return {
        ...logged,
        openBranch: { messageId, claimId },
        openMark: null,
        sourcePopover: null,
      };
    });
  },

  toggleSignals: () => {
    set((state) => {
      const on = !state.showAllSignals;
      return {
        ...appendEvent(state, { type: "signals_toggle", payload: { on } }),
        showAllSignals: on,
      };
    });
  },

  openSource: (sourceId, messageId) => {
    set((state) => {
      const message = state.messages.find((item) => item.id === messageId);
      return {
        ...appendEvent(state, {
          type: "source_open",
          scenario_id: message?.scenarioId,
          node_id: message?.nodeId,
          payload: { source_id: sourceId, message_id: messageId },
        }),
        sourcePopover: { messageId, sourceId },
        openMark: null, openBranch: null,
      };
    });
  },

  closeSource: () => set({ sourcePopover: null }),

  openExplainer: () => {
    set((state) =>
      state.explainerOpen
        ? state
        : {
            ...appendEvent({ ...state, explainerOpen: true }, { type: "explainer_open", payload: {} }),
            openMark: null, openBranch: null,
            sourcePopover: null,
          },
    );
  },

  closeExplainer: () => set({ explainerOpen: false }),

  openDecision: () => {
    set((state) => {
      if (state.phase !== "chat") return state;
      const scenarioId = state.scenarioOrder[state.scenarioIndex] ?? "";
      const turns = state.messages.filter(
        (message) => message.scenarioId === scenarioId && message.role === "user",
      ).length;
      if (turns < 2 || isBusy(state, scenarioId)) return state;
      return {
        ...appendEvent({ ...state, phase: "decision" }, {
          type: "decision_open",
          scenario_id: scenarioId,
          payload: {},
        }),
        openMark: null, openBranch: null,
      };
    });
  },

  closeDecision: () => {
    set((state) => (state.phase === "decision" ? { ...state, phase: "chat" } : state));
  },

  submitDecision: (input) => {
    set((state) => {
      const scenarioId = state.scenarioOrder[state.scenarioIndex] ?? "";
      const turns = state.messages.filter(
        (message) => message.scenarioId === scenarioId && message.role === "user",
      ).length;
      const submittedAt = state.scenarioStartedAt ? Date.now() - state.scenarioStartedAt : 0;
      let next: StudyData = {
        ...state,
        phase: "questionnaire",
        decisions: [
          ...state.decisions,
          {
            scenarioId,
            condition: activeCondition(state),
            optionId: input.optionId,
            reasonClaimIds: input.reasonClaimIds,
            otherReason: input.otherReason,
            beliefs: input.beliefs,
            userTurns: turns,
            submittedAt,
          },
        ],
      };
      next = appendEvent(next, {
        type: "decision_submit",
        scenario_id: scenarioId,
        payload: {
          option: input.optionId,
          reasons: input.reasonClaimIds,
          other: input.otherReason,
        },
      });
      for (const belief of input.beliefs) {
        next = appendEvent(next, {
          type: "belief",
          scenario_id: scenarioId,
          claim_id: belief.claimId,
          payload: { belief: belief.belief, confidence: belief.confidence },
        });
      }
      return { ...next, openMark: null, openBranch: null };
    });
  },

  submitQuestionnaire: (input) => {
    set((state) => {
      const scenarioId = state.scenarioOrder[state.scenarioIndex] ?? "";
      const condition = activeCondition(state);
      const record: QuestionnaireRecord = { ...input, scenarioId, condition };
      let next: StudyData = {
        ...state,
        questionnaires: [...state.questionnaires, record],
      };
      next = appendEvent(next, {
        type: "questionnaire",
        scenario_id: scenarioId,
        payload: { ...record },
      });
      const nextIndex = state.scenarioIndex + 1;
      if (nextIndex >= state.scenarioOrder.length) {
        return { ...next, phase: "done" };
      }
      const nextCondition = state.scenarioConditions[nextIndex] ?? "A";
      const needTutorial =
        nextCondition !== "A" && !state.tutorialsSeen.includes(nextCondition);
      return {
        ...next,
        scenarioIndex: nextIndex,
        phase: needTutorial ? "tutorial" : "chat",
        scenarioStartedAt: null,
        explainerOpen: false,
      };
    });
  },

  finishTutorial: () => {
    set((state) => {
      const condition = activeCondition(state);
      const seen = state.tutorialsSeen.includes(condition)
        ? state.tutorialsSeen
        : [...state.tutorialsSeen, condition];
      return {
        ...state,
        tutorialsSeen: seen,
        phase: "chat",
        scenarioStartedAt: null,
        explainerOpen: false,
        openMark: null, openBranch: null,
      };
    });
  },
}));

let saveTimer = 0;
useStudy.subscribe((state) => {
  if (!state.started) return;
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    const latest = useStudy.getState();
    if (latest.started) saveStudy(pick(latest));
  }, 250);
});

window.addEventListener("pagehide", () => {
  window.clearTimeout(saveTimer);
  const state = useStudy.getState();
  if (state.started) saveStudy(pick(state));
});

queueMicrotask(() => {
  const state = useStudy.getState();
  if (!state.started) return;
  for (const message of state.messages) {
    if (message.role === "assistant" && message.status === "settled" && !message.marksVisible) {
      later(() => revealMarks(message.id), state.delayMs);
    }
  }
});
