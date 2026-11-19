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
  | "instructions"
  | "tutorial"
  | "chat"
  | "decision"
  | "questionnaire"
  | "done";
export type BeliefValue = "True" | "False" | "Not sure";

export interface Passage {
  id: string;
  source_title: string;
  text: string;
}

export interface ClaimBranch {
  value: string;
  count: number;
  /** A passage backs or contradicts this specific value. */
  source?: "support" | "refute";
}

export interface Claim {
  id: string;
  text: string;
  consistency: { agree: number; total: number; alternatives: string[] };
  verdict: Verdict;
  evidence_ids: string[];
  is_planted_error: boolean;
  key_claim: boolean;
  supports_option?: string;
  /** Short sourced wording for the unstable-sourced popover. */
  source_says?: string;
  /** Substring of the claim to mark with a bar. */
  key_span: string;
  /** Sampled values, including the answer itself. Counts should sum to at most `total`. */
  branches: ClaimBranch[];
}

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "claim"; claim_id: string; text?: string };

export interface Chip {
  label: string;
  goto: string;
  condition?: Condition;
}

export interface IntentRule {
  keywords: string[];
  goto: string;
}

export interface Node {
  id: string;
  segments: Segment[];
  source_ids: string[];
  chips: Chip[];
  intents: IntentRule[];
  /** This reply is about a planted-error claim. Used for the question count. */
  about_claim?: string;
  about_claims?: string[];
}

export interface DecisionSpec {
  prompt: string;
  options: { id: string; label: string }[];
  correct_option: string;
  rationale_claim_ids: string[];
}

export interface Scenario {
  id: string;
  brief: string;
  decision: DecisionSpec;
  claims: Claim[];
  passages: Passage[];
  extra_passages: Passage[];
  start_node: string;
  fallback_node: string;
  nodes: Node[];
}

export interface ScenarioFile {
  _note: string;
  scenarios: Scenario[];
}

export type LogEventType =
  | "scenario_start"
  | "message_shown"
  | "mark_visible"
  | "mark_open"
  | "mark_hover"
  | "chip_tap"
  | "free_text"
  | "intent_routed"
  | "fallback_hit"
  | "source_open"
  | "explainer_open"
  | "decision_open"
  | "decision_submit"
  | "belief"
  | "questionnaire"
  | "bar_hover"
  | "branch_open"
  | "branch_select"
  | "branch_source_open"
  | "strip_expand"
  | "strip_row_click"
  | "signals_toggle";

export interface LogEvent {
  pid: string;
  condition: string;
  scenario_id: string;
  node_id?: string;
  claim_id?: string;
  type: LogEventType;
  payload: Record<string, unknown>;
  t: number;
  ts: string;
}

export interface UiMessage {
  id: string;
  role: "user" | "assistant";
  scenarioId: string;
  nodeId?: string;
  userText?: string;
  status: "thinking" | "streaming" | "settled";
  shownChars: number;
  marksVisible: boolean;
}

export interface BeliefAnswer {
  claimId: string;
  belief: BeliefValue;
  confidence: number;
}

export interface DecisionRecord {
  scenarioId: string;
  condition: string;
  optionId: string;
  reasonClaimIds: string[];
  otherReason: string;
  beliefs: BeliefAnswer[];
  userTurns: number;
  submittedAt: number;
}

export interface QuestionnaireRecord {
  scenarioId: string;
  condition: string;
  mental: number;
  performance: number;
  effort: number;
  frustration: number;
  trust_ai: number;
  trust_markers: number | null;
  would_use: number;
}

export interface RouteTrace {
  input: string;
  goto: string;
  matched: boolean;
  keyword?: string;
}

export interface StudyData {
  version: 1;
  pid: string;
  started: boolean;
  phase: Phase;
  mode: StudyMode;
  sessionCondition: Condition | "pilot";
  assignedFromHash: boolean;
  scenarioOrder: string[];
  scenarioConditions: Condition[];
  scenarioIndex: number;
  delayMs: number;
  tutorialsSeen: Condition[];
  messages: UiMessage[];
  events: LogEvent[];
  scenarioStartedAt: number | null;
  decisions: DecisionRecord[];
  questionnaires: QuestionnaireRecord[];
  lastRoute: RouteTrace | null;
  explainerOpen: boolean;
  booted: string[];
}
