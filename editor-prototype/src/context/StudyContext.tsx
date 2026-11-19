import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { readStudyParams } from "../lib/assignment.ts";
import { tasks, taskFile } from "../lib/data.ts";
import { deriveClaim } from "../lib/quadrant.ts";
import {
  advanceToQuestionnaire,
  blankSession,
  commitAction,
  completeTutorial,
  currentCondition,
  currentTaskId,
  flagClaim,
  markAlternatives,
  markDetails,
  markLegend,
  openSearch,
  reconcileSession,
  rollClaimTimer,
  selectClaim,
  selectEvidence,
  setConfidence,
  setDraftAnswer,
  skipEvidence,
  startSession,
  submitQuestionnaire,
  submitTask,
} from "../lib/session.ts";
import { clearSession, loadSession, saveSession } from "../lib/storage.ts";
import { validateTasks } from "../lib/validate.ts";
import type {
  Condition,
  HandlingAction,
  QuestionnaireResponse,
  SessionState,
  Task,
} from "../types.ts";

interface StudyApi {
  state: SessionState;
  debug: boolean;
  conditionFromUrl: Condition | null;
  pidFromUrl: string;
  warnings: string[];
  currentTask: Task | null;
  currentCondition: Condition;
  handledCount: number;
  claimCount: number;
  canSubmit: boolean;
  openEvidenceCount: number;
  conflict: boolean;
  keepSaved: () => void;
  startNewInstead: () => void;
  start: (pid: string) => void;
  completeTutorial: () => void;
  selectClaim: (id: string) => void;
  openDetail: (claimId: string | undefined, target: string) => void;
  openAlternatives: (claimId: string) => void;
  openLegend: () => void;
  commitAction: (claimId: string, action: HandlingAction, finalText: string) => void;
  selectEvidence: (claimId: string, evidenceId: string) => void;
  skipEvidence: (claimId: string) => void;
  openSearch: (claimId: string) => void;
  flagClaim: (claimId: string) => void;
  setConfidence: (claimId: string, value: number) => void;
  setDraft: (key: string, value: number) => void;
  advanceToQuestionnaire: () => void;
  submitTask: () => void;
  submitQuestionnaire: (response: Omit<QuestionnaireResponse, "task_id" | "condition">) => void;
  reset: () => void;
}

const StudyContext = createContext<StudyApi | null>(null);

export function StudyProvider({ children }: { children: ReactNode }) {
  const params = useMemo(() => readStudyParams(), []);
  const report = useMemo(() => validateTasks(taskFile), []);
  const [conflict, setConflict] = useState(() => {
    const saved = loadSession();
    return Boolean(saved && params.pid && saved.pid !== params.pid);
  });
  const [state, setState] = useState<SessionState>(() => {
    const saved = loadSession();
    return saved ? reconcileSession(saved) : blankSession();
  });
  const stateRef = useRef(state);
  stateRef.current = state;

  const update = useCallback((recipe: (prev: SessionState) => SessionState) => {
    setState((prev) => {
      const next = recipe(prev);
      stateRef.current = next;
      if (next.started) saveSession(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const flush = () => {
      setState((prev) => {
        if (!prev.started || prev.phase !== "task") return prev;
        const next = rollClaimTimer(prev, Date.now());
        stateRef.current = next;
        saveSession(next);
        return next;
      });
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    const id = window.setInterval(flush, 5000);
    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("pagehide", flush);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  const task = tasks.find((item) => item.id === currentTaskId(state)) ?? null;
  const handledCount = task
    ? task.claims.filter((claim) => state.claimStates[claim.id]?.handled).length
    : 0;
  const claimCount = task?.claims.length ?? 0;
  const openEvidenceCount = task
    ? task.claims.filter((claim) => state.claimStates[claim.id]?.evidencePromptOpen).length
    : 0;

  const api = useMemo<StudyApi>(
    () => ({
      state,
      debug: params.debug,
      conditionFromUrl: params.condition,
      pidFromUrl: params.pid,
      warnings: report.warnings,
      currentTask: task,
      currentCondition: currentCondition(state),
      handledCount,
      claimCount,
      canSubmit: claimCount > 0 && handledCount === claimCount,
      openEvidenceCount,
      conflict,
      keepSaved: () => setConflict(false),
      startNewInstead: () => {
        clearSession();
        const blank = blankSession();
        stateRef.current = blank;
        setState(blank);
        setConflict(false);
      },
      start: (pid: string) => update(() => startSession(pid, params, Date.now())),
      completeTutorial: () => update((prev) => completeTutorial(prev, Date.now())),
      selectClaim: (id: string) => update((prev) => selectClaim(prev, id, Date.now())),
      openDetail: (claimId: string | undefined, target: string) =>
        update((prev) => markDetails(prev, claimId, target, Date.now())),
      openAlternatives: (claimId: string) =>
        update((prev) => markAlternatives(prev, claimId, Date.now())),
      openLegend: () => update((prev) => markLegend(prev, Date.now())),
      commitAction: (claimId: string, action: HandlingAction, finalText: string) =>
        update((prev) => commitAction(prev, claimId, action, finalText, Date.now())),
      selectEvidence: (claimId: string, evidenceId: string) =>
        update((prev) => selectEvidence(prev, claimId, evidenceId, Date.now())),
      skipEvidence: (claimId: string) => update((prev) => skipEvidence(prev, claimId, Date.now())),
      openSearch: (claimId: string) => update((prev) => openSearch(prev, claimId, Date.now())),
      flagClaim: (claimId: string) => update((prev) => flagClaim(prev, claimId, Date.now())),
      setConfidence: (claimId: string, value: number) =>
        update((prev) => setConfidence(prev, claimId, value, Date.now())),
      setDraft: (key: string, value: number) => update((prev) => setDraftAnswer(prev, key, value)),
      advanceToQuestionnaire: () => update((prev) => advanceToQuestionnaire(prev)),
      submitTask: () => update((prev) => submitTask(prev, Date.now())),
      submitQuestionnaire: (response) =>
        update((prev) => submitQuestionnaire(prev, response, Date.now())),
      reset: () => {
        clearSession();
        const blank = blankSession();
        stateRef.current = blank;
        setState(blank);
        setConflict(false);
      },
    }),
    [claimCount, conflict, handledCount, openEvidenceCount, params, report.warnings, state, task, update],
  );

  if (report.errors.length > 0) {
    return (
      <div className="mx-auto max-w-3xl px-8 py-12">
        <h1 className="text-2xl font-medium text-stone-950">The study file needs a fix</h1>
        <p className="mt-3 text-stone-700">
          <code>src/data/tasks.json</code> has a problem, so the session did not start.
        </p>
        <ul className="mt-4 list-disc space-y-2 pl-5">
          {report.errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      </div>
    );
  }

  return <StudyContext.Provider value={api}>{children}</StudyContext.Provider>;
}

export function useStudy(): StudyApi {
  const value = useContext(StudyContext);
  if (!value) throw new Error("useStudy must be used inside StudyProvider");
  return value;
}

export function useDerivedSelection() {
  const study = useStudy();
  const claim = study.currentTask?.claims.find((item) => item.id === study.state.selectedClaimId);
  return claim ? deriveClaim(claim) : null;
}
