import type { Task } from "./types";
import { validateTasks } from "./workflow";

export type ManagerStage = "questions" | "answers" | "requirements" | "tasks";
const string = { type: "string" };
const strings = { type: "array", items: string };
// 1-3 Given/When/Then criteria per requirement (4 tolerated). The 12-character floor is enforced by the normalizer,
// because string length bounds are not part of the strict subset every provider accepts.
export const ACCEPTANCE_MIN_CHARS = 12;
export const ACCEPTANCE_MAX_ITEMS = 4;
const acceptance = { type: "array", minItems: 1, maxItems: ACCEPTANCE_MAX_ITEMS, items: string };
const fields = {
  questions: { prompt: string, why: string },
  answers: { questionId: string, answer: string },
  requirements: { text: string, priority: { type: "string", enum: ["must", "should", "could"] }, acceptance },
  tasks: { id: string, title: string, description: string, ownerAgent: { type: "string", enum: ["frontend", "backend", "database", "testing", "documentation"] }, dependencies: strings, expectedOutput: string, constraints: strings },
};
// `count` pins the item count when it is known (one drafted answer per question).
export function managerSchema(stage: ManagerStage, count?: number) {
  const properties = fields[stage];
  return { type: "object", properties: { items: { type: "array", minItems: count ?? 1, maxItems: count ?? 12, items: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } } }, required: ["items"], additionalProperties: false };
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 12000; }
// Replies without acceptance criteria are still accepted (older prompts, weaker models): they default to none.
// A present value must be a short list of real sentences.
function acceptanceList(value: unknown): string[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > ACCEPTANCE_MAX_ITEMS || !value.every((item) => text(item) && item.trim().length >= ACCEPTANCE_MIN_CHARS)) throw new Error("Invalid acceptance criteria.");
  return value.map((item: string) => item.trim());
}

export const MAX_STANDING_TEXT = 4000;
const PROJECT_TEXT_FIELDS = ["id", "title", "description", "targetUser", "approvedSummary"] as const;
/**
 * Project fields the model may see. Unknown fields are dropped. Rubric and constitution are optional strings of at most
 * 4,000 characters; anything else for them is an error rather than a silent drop, so a grading rubric is never lost unseen.
 */
export function sanitizeProject(value: unknown): { project: Record<string, string> } | { error: string } {
  if (!value || typeof value !== "object") return { error: "A valid project is required." };
  const raw = value as Record<string, unknown>;
  const project: Record<string, string> = {};
  for (const key of PROJECT_TEXT_FIELDS) if (typeof raw[key] === "string") project[key] = raw[key] as string;
  for (const key of ["rubric", "constitution"] as const) {
    const entry = raw[key];
    if (entry === undefined || entry === null || entry === "") continue;
    if (typeof entry !== "string" || entry.length > MAX_STANDING_TEXT) return { error: `Project ${key} must be text of at most ${MAX_STANDING_TEXT.toLocaleString("en-US")} characters.` };
    if (entry.trim()) project[key] = entry.trim();
  }
  return { project };
}
export function normalizeManagerItems(stage: ManagerStage, value: unknown, projectId: string) {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error("Manager returned an invalid or empty plan.");
  const items = value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid manager item.");
    const id = `${stage}-${index + 1}`;
    if (stage === "questions") {
      if (!text(raw.prompt) || !text(raw.why)) throw new Error("Invalid clarifying question.");
      return { id, prompt: raw.prompt, why: raw.why, answer: "" };
    }
    if (stage === "answers") {
      if (!text(raw.questionId) || !text(raw.answer) || raw.answer.trim().length < 12) throw new Error("Invalid drafted answer.");
      return { id: raw.questionId, answer: raw.answer.trim() };
    }
    if (stage === "requirements") {
      if (!text(raw.text) || !["must", "should", "could"].includes(raw.priority)) throw new Error("Invalid requirement.");
      return { id, projectId, text: raw.text, priority: raw.priority, acceptance: acceptanceList(raw.acceptance), approvalStatus: "pending" };
    }
    if (![raw.id, raw.title, raw.description, raw.expectedOutput].every(text) || !Array.isArray(raw.dependencies) || !raw.dependencies.every(text) || !Array.isArray(raw.constraints) || !raw.constraints.every(text)) throw new Error("Invalid task fields.");
    return { id: raw.id, projectId, title: raw.title, description: raw.description, ownerAgent: raw.ownerAgent, dependencies: raw.dependencies, expectedOutput: raw.expectedOutput, constraints: raw.constraints, state: "queued", order: index + 1 };
  });
  if (stage === "tasks") {
    const error = validateTasks(items as Task[]);
    if (error) throw new Error(error);
  }
  return items;
}
