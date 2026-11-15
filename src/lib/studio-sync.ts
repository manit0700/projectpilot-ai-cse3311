// Live link between planning and Website Studio. Both read the same saved project in this browser,
// so Studio no longer depends on a one-time hand-off from the planning tab.
import { createStudioHandoff, tidyBrief, type StudioHandoff } from "./studio-handoff";
import { initialState } from "./store-initial";
import { restoreSavedState, serializeState, STORAGE_KEY } from "./store-persistence";
import type { Feedback } from "./types";

/** The plan Studio builds from, rebuilt from the saved planning project; null until requirements and tasks are approved. */
export function readSavedPlan(): StudioHandoff | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return createStudioHandoff(restoreSavedState(raw, initialState()).state);
  } catch {
    return null;
  }
}

/** Identity of a plan's content. The id and confirmation time change on every build, so they are left out. */
export function planFingerprint(plan: StudioHandoff): string {
  // Older saved hand-offs repeat the title at the start of the brief; tidy both sides so that alone is not a change.
  return JSON.stringify([plan.projectId, tidyBrief(plan), plan.plan, plan.deliverables ?? "", plan.constitution ?? "", plan.rubric ?? ""]);
}

export function planChanged(current: StudioHandoff, saved: StudioHandoff): boolean {
  return planFingerprint(current) !== planFingerprint(saved);
}

const FEEDBACK_LIMIT = 2000;

/** Adds Studio review findings to the saved planning project as an open feedback item. Returns an error message, or null on success. */
export function sendFindingsToPlanning(findings: string, projectId: string): string | null {
  const text = findings.trim();
  if (!text) return "There are no review findings to send yet.";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return "Open the planning project in this browser first.";
    const saved = restoreSavedState(raw, initialState());
    if (saved.state.project.id !== projectId) return "Studio is using an older plan. Re-sync the plan first.";
    const item: Feedback = {
      id: crypto.randomUUID(),
      projectId,
      userRequest: `From Website Studio review: ${text.slice(0, FEEDBACK_LIMIT)}`,
      affectedTasks: [],
      revisionStatus: "open",
    };
    saved.state.feedbackItems = [...saved.state.feedbackItems, item];
    localStorage.setItem(STORAGE_KEY, serializeState(saved.state, saved.mode));
    return null;
  } catch {
    return "Could not save to the planning project. Browser storage may be full.";
  }
}
