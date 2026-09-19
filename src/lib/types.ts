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
}

export interface ClarifyingQuestion {
  id: string;
  prompt: string;
  answer: string;
  why: string;
}

export interface Requirement {
  id: string;
  projectId: string;
  text: string;
  priority: Priority;
  approvalStatus: ApprovalStatus;
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
  availability: "available" | "busy" | "offline";
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
  planningTimeSavedMinutes: number;
  usefulnessScore: number;
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
  sensitiveUploadAck: boolean;
  startedAt: number;
  conflictSummary: string | null;
}
