import type { AgentOutput, Review } from "./types";
import { uid } from "./agents";

const text = { type: "string" };
const texts = { type: "array", items: text };
const outputFields = { summary: text, assumptions: texts, blockers: texts, confidence: { type: "number", minimum: 0, maximum: 1 }, nextSteps: texts };
const reviewFields = { outputId: text, result: { type: "string", enum: ["pass", "flagged", "conflict"] }, missingItems: texts, conflicts: texts, suggestions: texts };
const object = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const specialistSchema = object(outputFields);
export const reviewSchema = object({ reviews: { type: "array", items: object(reviewFields) } });

function isText(v: unknown): v is string { return typeof v === "string" && v.trim().length > 0 && v.length <= 24000; }
function isTexts(v: unknown): v is string[] { return Array.isArray(v) && v.length <= 30 && v.every(isText); }
export function normalizeSpecialist(value: unknown, taskId: string, retryCount = 0): AgentOutput {
  const v = value as Partial<AgentOutput> | null;
  if (!v || !isText(v.summary) || !isTexts(v.assumptions) || !isTexts(v.blockers) || !isTexts(v.nextSteps) || typeof v.confidence !== "number" || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1) throw new Error("Invalid specialist output.");
  // IDs and approval state are assigned by the application, never by the model.
  return { id: uid("out"), taskId, summary: v.summary, assumptions: v.assumptions, blockers: v.blockers, confidence: v.confidence, nextSteps: v.nextSteps, retryCount, approved: "pending" };
}
export function normalizeReviews(value: unknown, outputs: AgentOutput[]): Review[] {
  const rows = (value as { reviews?: unknown } | null)?.reviews;
  if (!Array.isArray(rows) || rows.length !== outputs.length) throw new Error("Incomplete review.");
  const seen = new Set<string>();
  return rows.map((v) => {
    if (!v || !outputs.some((o) => o.id === v.outputId) || seen.has(v.outputId) || !["pass", "flagged", "conflict"].includes(v.result) || !isTexts(v.missingItems) || !isTexts(v.conflicts) || !isTexts(v.suggestions)) throw new Error("Invalid review.");
    seen.add(v.outputId);
    const result = v.conflicts.length ? "conflict" : v.missingItems.length ? "flagged" : v.result;
    return { id: uid("review"), outputId: v.outputId, result, missingItems: v.missingItems, conflicts: v.conflicts, suggestions: v.suggestions };
  });
}
