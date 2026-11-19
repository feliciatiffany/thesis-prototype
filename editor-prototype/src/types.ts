export type Verdict = "SUPPORTED" | "REFUTED" | "NEI";
export type Quadrant =
  | "solid"
  | "confidently_wrong"
  | "speculation"
  | "unstable_sourced";
export type Condition = "A" | "B" | "C" | "D";
export type StudyMode = "standard" | "pilot";
export type Phase =
  | "consent"
  | "tutorial"
  | "task"
  | "confidence"
  | "questionnaire"
  | "done";

export type HandlingAction =
  | "keep"
  | "delete"
  | "hedge"
  | "rewrite"
  | "use_source";

export interface Passage {
  id: string;
  source_title: string;
  text: string;
}

export interface Claim {
  id: string;
  text: string;
  consistency: { agree: number; total: number; alternatives: string[] };
  verdict: Verdict;
  evidence_ids: string[];
  source_wording?: string;
  is_planted_error: boolean;
  correct_actions: string[];
}

export interface Task {
  id: string;
  question: string;
  claims: Claim[];
  passages: Passage[];
  extra_passages: Passage[];
  omitted_source_claims: string[];
}

export interface TaskFile {
  _note: string;
  tasks: Task[];
}

export type LogEventType =
  | "task_start"
  | "claim_open"
  | "detail_open"
  | "alternatives_open"
  | "legend_open"
  | "action"
  | "evidence_select"
  | "search_open"
  | "text_edit"
  | "confidence"
  | "submit"
  | "questionnaire";

export interface LogEvent {
  pid: string;
  condition: string;
  task_id: string;
  claim_id?: string;
  type: LogEventType;
  payload: Record<string, unknown>;
  t: number;
  ts: string;
}

export interface ClaimRuntime {
  action: HandlingAction | null;
  finalText: string;
  evidenceId: string | null;
  evidenceSkipped: boolean;
  evidencePromptOpen: boolean;
  handled: boolean;
  flagged: boolean;
  confidence: number | null;
  detailsOpened: boolean;
  searchOpened: boolean;
  timeOnClaimMs: number;
  openStartedAt: number | null;
}

export interface QuestionnaireResponse {
  task_id: string;
  condition: string;
  mental: number;
  physical: number;
  temporal: number;
  performance: number;
  effort: number;
  frustration: number;
  trust_ai: number;
  trust_interface: number;
  control: number;
}

export interface ClaimSummaryRow {
  pid: string;
  condition: string;
  task_id: string;
  claim_id: string;
  quadrant: Quadrant;
  verdict: Verdict;
  is_planted_error: boolean;
  final_action: string;
  final_text: string;
  evidence_selected: string;
  evidence_correct: boolean;
  action_correct: boolean;
  human_fever_correct: boolean;
  confidence: number | "";
  time_on_claim_ms: number;
  details_opened: boolean;
  evidence_skipped: boolean;
}

export interface SessionState {
  version: 1;
  pid: string;
  mode: StudyMode;
  sessionCondition: Condition | "pilot";
  assignedFromHash: boolean;
  taskOrder: string[];
  taskConditions: Condition[];
  phase: Phase;
  taskIndex: number;
  tutorialCondition: Condition | null;
  tutorialStartedAt: number | null;
  tutorialsSeen: Condition[];
  selectedClaimId: string | null;
  claimStates: Record<string, ClaimRuntime>;
  questionnaires: QuestionnaireResponse[];
  events: LogEvent[];
  taskStartedAt: number | null;
  started: boolean;
  draftAnswers: Record<string, number>;
}
