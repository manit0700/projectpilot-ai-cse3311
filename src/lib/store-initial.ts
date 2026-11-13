import { AGENTS } from "./agents";
import { EMPTY_METRICS } from "./metrics";
import { EMPTY_USAGE, type WorkflowState } from "./workflow";

export function initialState(): WorkflowState {
  return {
    project: { id: "", title: "", description: "", targetUser: "", approvedSummary: "", status: "draft", createdAt: "" },
    questions: [],
    requirements: [],
    tasks: [],
    agents: AGENTS,
    outputs: [],
    reviews: [],
    feedbackItems: [],
    managerNotes: [],
    metrics: EMPTY_METRICS,
    currentStep: "idea",
    planApproved: false,
    startedAt: Date.now(),
    completedAt: null,
    conflictSummary: null,
    staleTaskIds: [],
    revisionTaskIds: [],
    skippedTaskIds: [],
    workflowNotice: null,
    events: [],
    usage: EMPTY_USAGE,
  };
}
