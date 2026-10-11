import type { Task } from "./types";
import { validateTasks } from "./workflow";

export type ManagerStage = "questions" | "requirements" | "tasks";
const string = { type: "string" };
const strings = { type: "array", items: string };
const fields = {
  questions: { prompt: string, why: string },
  requirements: { text: string, priority: { type: "string", enum: ["must", "should", "could"] } },
  tasks: { id: string, title: string, description: string, ownerAgent: { type: "string", enum: ["frontend", "backend", "database", "testing", "documentation"] }, dependencies: strings, expectedOutput: string, constraints: strings },
};
export function managerSchema(stage: ManagerStage) {
  const properties = fields[stage];
  return { type: "object", properties: { items: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", properties, required: Object.keys(properties), additionalProperties: false } } }, required: ["items"], additionalProperties: false };
}
function text(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 12000; }
export function normalizeManagerItems(stage: ManagerStage, value: unknown, projectId: string) {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw new Error("Manager returned an invalid or empty plan.");
  const items = value.map((raw, index) => {
    if (!raw || typeof raw !== "object") throw new Error("Invalid manager item.");
    const id = `${stage}-${index + 1}`;
    if (stage === "questions") {
      if (!text(raw.prompt) || !text(raw.why)) throw new Error("Invalid clarifying question.");
      return { id, prompt: raw.prompt, why: raw.why, answer: "" };
    }
    if (stage === "requirements") {
      if (!text(raw.text) || !["must", "should", "could"].includes(raw.priority)) throw new Error("Invalid requirement.");
      return { id, projectId, text: raw.text, priority: raw.priority, approvalStatus: "pending" };
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
