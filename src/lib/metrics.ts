import type { SessionEvent } from "./session-log";
import type { AgentOutput, EvaluationMetrics, Feedback, Requirement, Review, Task } from "./types";

// Every number here is counted or measured in this session. Nothing is estimated.
export const EMPTY_METRICS: EvaluationMetrics = {
  userAcceptanceRate: 0,
  numberOfRevisions: 0,
  taskCompletionRate: 0,
  conflictRate: 0,
  planningElapsedMinutes: 0,
  usefulnessScore: null,
};

const percent = (part: number, whole: number) => (whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1)));

/** Wall-clock minutes (one decimal) from the project start to `endedAt`, or to now. */
export function elapsedMinutes(startedAt: number, endedAt: number | null = null, now = Date.now()): number {
  if (!Number.isFinite(startedAt) || startedAt <= 0) return 0;
  const end = endedAt ?? now;
  return Math.max(0, Number(((end - startedAt) / 60000).toFixed(1)));
}

export function normalizeUsefulness(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 10 ? value : null;
}

export const formatUsefulness = (score: number | null) => (score === null ? "Not rated" : `${score}/10`);

/** An output counts as an issue when the review flagged it or it carries a blocker or low confidence. */
export function issueOutputIds(reviews: Review[], outputs: AgentOutput[]): Set<string> {
  const ids = new Set<string>();
  for (const r of reviews) if (r.result !== "pass" || r.missingItems.length || r.conflicts.length) ids.add(r.outputId);
  for (const o of outputs) if (o.blockers.length > 0 || o.confidence < 0.8) ids.add(o.id);
  return ids;
}

/** Revision rounds: feedback items opened, or revision/feedback events logged, whichever shows more. */
export function revisionRounds(feedbackItems: Feedback[], events: SessionEvent[] = [], outputs: AgentOutput[] = []): number {
  const opened = feedbackItems.filter((f) => f.revisionStatus !== "dismissed").length;
  const logged = Math.max(events.filter((e) => e.type === "revision_requested").length, events.filter((e) => e.type === "feedback_submitted").length);
  const rejected = events.some((e) => e.type === "output_rejected") || outputs.some((o) => o.approved === "rejected") ? 1 : 0;
  return Math.max(opened, logged, rejected);
}

export function computeMetrics(input: {
  requirements: Requirement[];
  tasks: Task[];
  reviews: Review[];
  feedbackItems: Feedback[];
  outputs?: AgentOutput[];
  events?: SessionEvent[];
  startedAt: number;
  completedAt?: number | null;
  usefulnessScore: number | null;
  now?: number;
}): EvaluationMetrics {
  const approvedReqs = input.requirements.filter((r) => r.approvalStatus === "approved").length;
  const decidedReqs = input.requirements.filter((r) => r.approvalStatus !== "pending").length;
  const completedTasks = input.tasks.filter((t) => t.state === "completed").length;
  const outputs = input.outputs ?? [];
  // Issue rate counts every review finding, not only hard conflicts, so it cannot read 0% beside a flagged output.
  const issues = issueOutputIds(input.reviews, outputs).size;
  const reviewed = outputs.length || input.reviews.length;

  return {
    userAcceptanceRate: percent(approvedReqs, decidedReqs),
    numberOfRevisions: revisionRounds(input.feedbackItems, input.events, outputs),
    taskCompletionRate: percent(completedTasks, input.tasks.length),
    conflictRate: percent(issues, reviewed),
    planningElapsedMinutes: elapsedMinutes(input.startedAt, input.completedAt ?? null, input.now),
    usefulnessScore: normalizeUsefulness(input.usefulnessScore),
  };
}
