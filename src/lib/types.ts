export type ProjectStatus =
  | "draft"
  | "clarifying"
  | "requirements_pending"
  | "tasks_pending"
  | "plan_approved"
  | "agents_running"
  | "review_pending"
  | "feedback_pending"
  | "revising"
  | "complete";

export type ApprovalStatus = "pending" | "approved" | "rejected";

export type TaskState =
  | "queued"
  | "blocked"
  | "in_progress"
  | "completed"
  | "needs_revision"
  | "failed";

export type AgentRole =
  | "manager"
  | "frontend"
  | "backend"
  | "database"
  | "testing"
  | "documentation"
  | "review";

export type WorkflowStep =
  | "idea"
  | "questions"
  | "requirements"
  | "tasks"
  | "board"
  | "review"
  | "feedback"
  | "final";

export type Priority = "must" | "should" | "could";

export interface Project {
  id: string;
  title: string;
  description: string;
  targetUser: string;
  approvedSummary: string;
  status: ProjectStatus;
  createdAt: string;
  /** Optional grading rubric the plan should satisfy; trimmed, at most 4,000 characters. */
  rubric?: string;
  /** Optional project constitution (standing rules for every agent); trimmed, at most 4,000 characters. */
  constitution?: string;
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  answer: string;
  why: string;
  /** True while the answer is an unedited AI/manager draft; cleared when the user edits it. */
  suggested?: boolean;
}

export interface Requirement {
  id: string;
  projectId: string;
  text: string;
  priority: Priority;
  approvalStatus: ApprovalStatus;
  /** Given/When/Then acceptance criteria, at most 4 per requirement. */
  acceptance?: string[];
}

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  ownerAgent: AgentRole;
  dependencies: string[];
  expectedOutput: string;
  constraints: string;
  state: TaskState;
  order: number;
}

export interface Agent {
  id: string;
  role: AgentRole;
  capability: string;
  availability: "available" | "busy";
}

export interface AgentOutput {
  id: string;
  taskId: string;
  summary: string;
  assumptions: string[];
  blockers: string[];
  confidence: number;
  nextSteps: string[];
  retryCount: number;
  approved: ApprovalStatus;
  /** True once a person rewrote the summary, so the AI original is never mistaken for the final text. */
  humanEdited?: boolean;
}

export interface Review {
  id: string;
  outputId: string;
  result: "pass" | "flagged" | "conflict";
  missingItems: string[];
  conflicts: string[];
  suggestions: string[];
}

export interface Feedback {
  id: string;
  projectId: string;
  userRequest: string;
  affectedTasks: string[];
  revisionStatus: "open" | "applied" | "dismissed";
}

/** Running total of model calls in this project. Stays zero in Demo mode: nothing is estimated. */
export interface UsageSummary {
  requests: number;
  promptTokens: number;
  completionTokens: number;
  totalLatencyMs: number;
  /** Distinct `provider/model` labels that served requests. */
  models: string[];
}

export interface ManagerNote {
  id: string;
  at: string;
  step: WorkflowStep;
  message: string;
}

export interface EvaluationMetrics {
  userAcceptanceRate: number;
  numberOfRevisions: number;
  taskCompletionRate: number;
  conflictRate: number;
  /** Measured wall-clock minutes from project start to completion (or now). */
  planningElapsedMinutes: number;
  /** User's own 1-10 rating; null until the user rates. */
  usefulnessScore: number | null;
}

export interface ProjectContext {
  project: Project;
  questions: ClarifyingQuestion[];
  requirements: Requirement[];
  tasks: Task[];
  agents: Agent[];
  outputs: AgentOutput[];
  reviews: Review[];
  feedbackItems: Feedback[];
  managerNotes: ManagerNote[];
  metrics: EvaluationMetrics;
  currentStep: WorkflowStep;
  planApproved: boolean;
  /** Epoch ms when the project started; the measured planning time counts from here. */
  startedAt: number;
  conflictSummary: string | null;
}
