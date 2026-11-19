import { claimById, tasks } from "./data.ts";
import { evidenceIsRequired } from "./labels.ts";
import { deriveClaim } from "./quadrant.ts";
import { conditionFromPid, latinSquareOrder, pilotPlan } from "./assignment.ts";
import type {
  ClaimRuntime,
  Condition,
  HandlingAction,
  LogEvent,
  QuestionnaireResponse,
  SessionState,
  StudyMode,
} from "../types.ts";

interface StartParams {
  condition: Condition | null;
  mode: StudyMode;
}

export function blankSession(): SessionState {
  return {
    version: 1,
    pid: "",
    mode: "standard",
    sessionCondition: "A",
    assignedFromHash: false,
    taskOrder: [],
    taskConditions: [],
    phase: "consent",
    taskIndex: 0,
    tutorialCondition: null,
    tutorialStartedAt: null,
    tutorialsSeen: [],
    selectedClaimId: null,
    claimStates: {},
    questionnaires: [],
    events: [],
    taskStartedAt: null,
    started: false,
    draftAnswers: {},
  };
}

export function initialClaimState(text: string): ClaimRuntime {
  return {
    action: null,
    finalText: text,
    evidenceId: null,
    evidenceSkipped: false,
    evidencePromptOpen: false,
    handled: false,
    flagged: false,
    confidence: null,
    detailsOpened: false,
    searchOpened: false,
    timeOnClaimMs: 0,
    openStartedAt: null,
  };
}

function updateClaim(
  state: SessionState,
  id: string,
  patch: Partial<ClaimRuntime>,
): SessionState {
  const current = state.claimStates[id];
  if (!current) return state;
  return {
    ...state,
    claimStates: {
      ...state.claimStates,
      [id]: { ...current, ...patch },
    },
  };
}

export function accumulate(state: SessionState, now: number): SessionState {
  const id = state.selectedClaimId;
  if (!id) return state;
  const current = state.claimStates[id];
  if (!current?.openStartedAt) return state;
  return updateClaim(state, id, {
    timeOnClaimMs: current.timeOnClaimMs + Math.max(0, now - current.openStartedAt),
    openStartedAt: null,
  });
}

export function rollClaimTimer(state: SessionState, now: number): SessionState {
  const closed = accumulate(state, now);
  if (closed.phase !== "task" || !closed.selectedClaimId) return closed;
  return updateClaim(closed, closed.selectedClaimId, { openStartedAt: now });
}

export function currentCondition(state: SessionState): Condition {
  return state.taskConditions[state.taskIndex] ?? "A";
}

export function currentTaskId(state: SessionState): string {
  return state.taskOrder[state.taskIndex] ?? "";
}

function stamp(state: SessionState, now: number) {
  return {
    t: state.taskStartedAt ? Math.max(0, now - state.taskStartedAt) : 0,
    ts: new Date(now).toISOString(),
  };
}

function pushEvent(
  state: SessionState,
  type: LogEvent["type"],
  payload: Record<string, unknown>,
  now: number,
  claimId?: string,
  taskId?: string,
  condition?: string,
): SessionState {
  const event: LogEvent = {
    pid: state.pid,
    condition: condition ?? currentCondition(state),
    task_id: taskId ?? currentTaskId(state),
    type,
    payload,
    ...stamp(state, now),
    ...(claimId ? { claim_id: claimId } : {}),
  };
  return { ...state, events: [...state.events, event] };
}

function taskStartEvent(
  state: SessionState,
  now: number,
  taskIndex: number,
  tutorialMs?: number,
): SessionState {
  const taskId = state.taskOrder[taskIndex] ?? "";
  const task = tasks.find((item) => item.id === taskId);
  const condition = state.taskConditions[taskIndex] ?? "A";
  return pushEvent(
    state,
    "task_start",
    {
      task_index: taskIndex,
      question: task?.question ?? "",
      claim_ids: task?.claims.map((claim) => claim.id) ?? [],
      ...(tutorialMs != null ? { tutorial_ms: tutorialMs } : {}),
    },
    now,
    undefined,
    taskId,
    condition,
  );
}

function claimStatesFor(taskIds: string[]): Record<string, ClaimRuntime> {
  const claimStates: Record<string, ClaimRuntime> = {};
  for (const taskId of taskIds) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) continue;
    for (const claim of task.claims) {
      claimStates[claim.id] = initialClaimState(claim.text);
    }
  }
  return claimStates;
}

function needsTutorial(condition: Condition, seen: Condition[]): boolean {
  return condition !== "A" && !seen.includes(condition);
}

export function startSession(pid: string, params: StartParams, now: number): SessionState {
  const trimmed = pid.trim();
  const mode: StudyMode = params.mode;
  let taskOrder: string[];
  let taskConditions: Condition[];
  let sessionCondition: Condition | "pilot";
  let assignedFromHash = false;

  if (mode === "pilot") {
    const plan = pilotPlan(trimmed);
    taskOrder = plan.taskIds;
    taskConditions = plan.conditions;
    sessionCondition = "pilot";
  } else if (params.condition) {
    taskOrder = latinSquareOrder(
      trimmed,
      tasks.map((task) => task.id),
    );
    taskConditions = taskOrder.map(() => params.condition as Condition);
    sessionCondition = params.condition;
  } else {
    const assigned = conditionFromPid(trimmed);
    assignedFromHash = true;
    taskOrder = latinSquareOrder(
      trimmed,
      tasks.map((task) => task.id),
    );
    taskConditions = taskOrder.map(() => assigned);
    sessionCondition = assigned;
  }

  const first = taskConditions[0] ?? "A";
  const tutorial = needsTutorial(first, []);
  let state: SessionState = {
    version: 1,
    pid: trimmed,
    mode,
    sessionCondition,
    assignedFromHash,
    taskOrder,
    taskConditions,
    phase: tutorial ? "tutorial" : "task",
    taskIndex: 0,
    tutorialCondition: tutorial ? first : null,
    tutorialStartedAt: tutorial ? now : null,
    tutorialsSeen: [],
    selectedClaimId: null,
    claimStates: claimStatesFor(taskOrder),
    questionnaires: [],
    events: [],
    taskStartedAt: tutorial ? null : now,
    started: true,
    draftAnswers: {},
  };
  if (!tutorial) state = taskStartEvent(state, now, 0);
  return state;
}

export function reconcileSession(state: SessionState): SessionState {
  const claimStates = { ...state.claimStates };
  for (const taskId of state.taskOrder) {
    const task = tasks.find((item) => item.id === taskId);
    if (!task) continue;
    for (const claim of task.claims) {
      if (!claimStates[claim.id]) claimStates[claim.id] = initialClaimState(claim.text);
    }
  }
  let next: SessionState = { ...state, claimStates, draftAnswers: state.draftAnswers ?? {} };
  if (next.phase === "task" && next.selectedClaimId && next.claimStates[next.selectedClaimId]) {
    next = updateClaim(next, next.selectedClaimId, { openStartedAt: Date.now() });
  }
  return next;
}

function requiredFor(state: SessionState, claimId: string): boolean {
  const found = claimById(claimId);
  if (!found) return false;
  return evidenceIsRequired(currentCondition(state), deriveClaim(found.claim).quadrant);
}

function handledAfter(
  action: HandlingAction | null,
  evidenceId: string | null,
  required: boolean,
): boolean {
  if (!action) return false;
  if (required && evidenceId == null) return false;
  return true;
}

export function completeTutorial(state: SessionState, now: number): SessionState {
  const condition = state.tutorialCondition;
  if (!condition) return state;
  const elapsed = state.tutorialStartedAt ? Math.max(0, now - state.tutorialStartedAt) : 0;
  const seen = state.tutorialsSeen.includes(condition)
    ? state.tutorialsSeen
    : [...state.tutorialsSeen, condition];
  let next: SessionState = {
    ...state,
    tutorialsSeen: seen,
    tutorialCondition: null,
    phase: "task",
    taskStartedAt: now,
    selectedClaimId: null,
  };
  next = taskStartEvent(next, now, next.taskIndex, elapsed);
  return next;
}

export function selectClaim(state: SessionState, claimId: string, now: number): SessionState {
  if (state.selectedClaimId === claimId) return state;
  let next = accumulate(state, now);
  next = {
    ...next,
    selectedClaimId: claimId,
  };
  next = updateClaim(next, claimId, { openStartedAt: now });
  return pushEvent(next, "claim_open", {}, now, claimId);
}

export function markDetails(
  state: SessionState,
  claimId: string | undefined,
  target: string,
  now: number,
): SessionState {
  let next = state;
  if (claimId && next.claimStates[claimId]) {
    next = updateClaim(next, claimId, { detailsOpened: true });
  }
  return pushEvent(next, "detail_open", { target }, now, claimId);
}

export function markAlternatives(state: SessionState, claimId: string, now: number): SessionState {
  const next = updateClaim(state, claimId, { detailsOpened: true });
  return pushEvent(next, "alternatives_open", {}, now, claimId);
}

export function markLegend(state: SessionState, now: number): SessionState {
  let next = state;
  if (state.selectedClaimId) {
    next = updateClaim(next, state.selectedClaimId, { detailsOpened: true });
  }
  return pushEvent(next, "legend_open", {}, now, state.selectedClaimId ?? undefined);
}

export function commitAction(
  state: SessionState,
  claimId: string,
  action: HandlingAction,
  finalText: string,
  now: number,
): SessionState {
  const required = requiredFor(state, claimId);
  const current = state.claimStates[claimId];
  if (!current) return state;
  const evidenceId = null;
  const prompt = required || action !== "keep";
  let next = updateClaim(state, claimId, {
    action,
    finalText,
    evidenceId,
    evidenceSkipped: false,
    evidencePromptOpen: prompt,
    handled: handledAfter(action, evidenceId, required),
  });
  next = pushEvent(
    next,
    "action",
    { action, final_text: finalText },
    now,
    claimId,
  );
  if (action === "hedge" || action === "rewrite" || action === "use_source") {
    next = pushEvent(next, "text_edit", { action, final_text: finalText }, now, claimId);
  }
  return next;
}

export function selectEvidence(
  state: SessionState,
  claimId: string,
  evidenceId: string,
  now: number,
): SessionState {
  const current = state.claimStates[claimId];
  if (!current?.action) return state;
  const required = requiredFor(state, claimId);
  let next = updateClaim(state, claimId, {
    evidenceId,
    evidenceSkipped: false,
    evidencePromptOpen: false,
    handled: handledAfter(current.action, evidenceId, required),
  });
  next = pushEvent(next, "evidence_select", { evidence_id: evidenceId }, now, claimId);
  return next;
}

export function skipEvidence(state: SessionState, claimId: string, now: number): SessionState {
  if (requiredFor(state, claimId)) return state;
  const current = state.claimStates[claimId];
  if (!current?.action) return state;
  let next = updateClaim(state, claimId, {
    evidenceId: null,
    evidenceSkipped: true,
    evidencePromptOpen: false,
    handled: true,
  });
  next = pushEvent(next, "evidence_select", { skipped: true }, now, claimId);
  return next;
}

export function openSearch(state: SessionState, claimId: string, now: number): SessionState {
  let next = updateClaim(state, claimId, { searchOpened: true });
  next = pushEvent(next, "search_open", {}, now, claimId);
  return next;
}

export function flagClaim(state: SessionState, claimId: string, now: number): SessionState {
  const current = state.claimStates[claimId];
  if (!current) return state;
  const flagged = !current.flagged;
  let next = updateClaim(state, claimId, { flagged });
  next = pushEvent(next, "action", { action: "flag", flagged }, now, claimId);
  return next;
}

export function setConfidence(
  state: SessionState,
  claimId: string,
  value: number,
  now: number,
): SessionState {
  const next = updateClaim(state, claimId, { confidence: value });
  return pushEvent(next, "confidence", { rating: value }, now, claimId);
}

export function submitTask(state: SessionState, now: number): SessionState {
  const taskId = currentTaskId(state);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return state;
  const allHandled = task.claims.every((claim) => state.claimStates[claim.id]?.handled);
  if (!allHandled) return state;
  let next = accumulate(state, now);
  for (const claim of task.claims) {
    const runtime = next.claimStates[claim.id];
    if (runtime?.evidencePromptOpen && runtime.evidenceId == null) {
      next = updateClaim(next, claim.id, {
        evidencePromptOpen: false,
        evidenceSkipped: true,
      });
    }
  }
  next = pushEvent(
    next,
    "submit",
    { claim_ids: task.claims.map((claim) => claim.id) },
    now,
  );
  return { ...next, phase: "confidence", selectedClaimId: null };
}

export function advanceToQuestionnaire(state: SessionState): SessionState {
  if (state.phase !== "confidence") return state;
  return { ...state, phase: "questionnaire" };
}

export function setDraftAnswer(
  state: SessionState,
  key: string,
  value: number,
): SessionState {
  return { ...state, draftAnswers: { ...state.draftAnswers, [key]: value } };
}

export function submitQuestionnaire(
  state: SessionState,
  response: Omit<QuestionnaireResponse, "task_id" | "condition">,
  now: number,
): SessionState {
  const taskId = currentTaskId(state);
  const condition = currentCondition(state);
  const full: QuestionnaireResponse = { ...response, task_id: taskId, condition };
  let next: SessionState = {
    ...state,
    questionnaires: [...state.questionnaires, full],
  };
  next = pushEvent(next, "questionnaire", { ...full }, now, undefined, taskId, condition);

  const nextIndex = state.taskIndex + 1;
  if (nextIndex >= state.taskOrder.length) {
    return { ...next, phase: "done", selectedClaimId: null, taskStartedAt: null };
  }
  const nextCondition = state.taskConditions[nextIndex] ?? "A";
  if (needsTutorial(nextCondition, next.tutorialsSeen)) {
    return {
      ...next,
      taskIndex: nextIndex,
      phase: "tutorial",
      tutorialCondition: nextCondition,
      tutorialStartedAt: now,
      selectedClaimId: null,
      taskStartedAt: null,
    };
  }
  next = {
    ...next,
    taskIndex: nextIndex,
    phase: "task",
    selectedClaimId: null,
    taskStartedAt: now,
    tutorialCondition: null,
  };
  return taskStartEvent(next, now, nextIndex);
}
