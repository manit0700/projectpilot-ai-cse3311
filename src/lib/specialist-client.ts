import type { AgentOutput, ProjectContext, Task } from "./types";
import { normalizeReviews, normalizeSpecialist } from "./specialist-schema";

async function request(body: unknown) {
  const response = await fetch("/api/specialist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(65000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Specialist request failed.");
  return result;
}
export async function runLiveSpecialist(task: Task, context: ProjectContext, feedback = "", previousOutput?: AgentOutput): Promise<AgentOutput> {
  const result = await request({ stage: "execute", taskId: task.id, context, feedback, previousOutput });
  return normalizeSpecialist(result.output, task.id, result.output?.retryCount === 1 ? 1 : 0);
}
export async function runLiveReview(context: ProjectContext) {
  const result = await request({ stage: "review", context });
  const reviews = normalizeReviews(result, context.outputs);
  return { reviews, conflictSummary: reviews.flatMap((r) => [...r.conflicts, ...r.missingItems]).join("; ") || null };
}
