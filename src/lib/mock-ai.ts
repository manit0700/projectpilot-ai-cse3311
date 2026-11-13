import { AGENTS, uid } from "./agents";
import { acceptanceFor } from "./mock-acceptance";
import { deliverableNextSteps, deliverableSummary, revisedSummary } from "./mock-deliverables";
import type {
  AgentOutput,
  AgentRole,
  ClarifyingQuestion,
  Project,
  Requirement,
  Review,
  Task,
} from "./types";

export function titleFromIdea(idea: string): string {
  const cleaned = idea.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 48) return cleaned || "Untitled Project";
  return `${cleaned.slice(0, 45)}...`;
}

const MAX_BRIEF_TEXT = 4000;
const optionalText = (value: string | undefined) => value?.trim().slice(0, MAX_BRIEF_TEXT) || undefined;

export function createProject(
  idea: string,
  targetUser: string,
  options: { rubric?: string; constitution?: string } = {},
): Project {
  const rubric = optionalText(options.rubric), constitution = optionalText(options.constitution);
  return {
    ...(rubric ? { rubric } : {}),
    ...(constitution ? { constitution } : {}),
    id: uid("proj"),
    title: titleFromIdea(idea),
    description: idea.trim(),
    targetUser: targetUser.trim() || "Student developers",
    approvedSummary: "",
    status: "clarifying",
    createdAt: new Date().toISOString(),
  };
}

export function generateQuestions(idea: string): ClarifyingQuestion[] {
  const lower = idea.toLowerCase();
  const base: ClarifyingQuestion[] = [
    {
      id: uid("q"),
      prompt: "Who is the primary user of this project?",
      answer: "",
      why: "Scope and UX decisions depend on the target user.",
    },
    {
      id: uid("q"),
      prompt: "What is the most important feature for your project?",
      answer: "",
      why: "Keeps the task breakdown focused for a class or hackathon deadline.",
    },
    {
      id: uid("q"),
      prompt: "What tech stack constraints do you have (language, host, DB)?",
      answer: "",
      why: "Affects backend, database, and deployment planning.",
    },
    {
      id: uid("q"),
      prompt: "Do you need login/auth for the first release?",
      answer: "",
      why: "Auth changes security requirements and task order.",
    },
  ];

  if (lower.includes("mobile") || lower.includes("ios") || lower.includes("android")) {
    base.push({
      id: uid("q"),
      prompt: "Is this a native mobile app, PWA, or responsive web app?",
      answer: "",
      why: "Changes frontend agent work and testing checklist.",
    });
  }

  if (/\b(ai|llm|chat|chatbot)\b/i.test(lower)) {
    base.push({
      id: uid("q"),
      prompt: "Should the project use a live AI API or prepared responses first?",
      answer: "",
      why: "API keys and cost constraints affect architecture.",
    });
  }

  return base;
}

export function generateRequirements(
  project: Project,
  questions: ClarifyingQuestion[],
): Requirement[] {
  const answers = Object.fromEntries(
    questions.map((q) => [q.prompt, q.answer.trim() || "(not specified)"]),
  );
  const coreFeature =
    answers["What is the most important feature for your project?"] ||
    "core happy-path flow";
  const auth =
    answers["Do you need login/auth for the first release?"] || "not specified";
  const stack =
    answers["What tech stack constraints do you have (language, host, DB)?"] ||
    "not specified";

  const texts: { text: string; priority: Requirement["priority"] }[] = [
    { text: `Support the project idea: ${project.description}`, priority: "must" },
    { text: `Serve target users: ${project.targetUser}`, priority: "must" },
    { text: `Deliver project focus: ${coreFeature}`, priority: "must" },
    { text: `Respect stack constraints: ${stack}`, priority: "should" },
    { text: `Auth decision for first release: ${auth}`, priority: "should" },
    { text: "Provide clear human approval checkpoints before major changes", priority: "must" },
    { text: "Include a testing checklist and README for reviewers", priority: "should" },
    { text: "Do not auto-deploy; require explicit user approval for repo/deploy actions", priority: "must" },
  ];

  return texts.map((item) => ({
    id: uid("req"),
    projectId: project.id,
    text: item.text,
    priority: item.priority,
    approvalStatus: "pending" as const,
    acceptance: acceptanceFor(item.text, item.priority),
  }));
}

function pickOwner(title: string): AgentRole {
  const t = title.toLowerCase();
  if (t.includes("ui") || t.includes("frontend") || t.includes("screen")) {
    return "frontend";
  }
  if (t.includes("api") || t.includes("backend") || t.includes("server")) {
    return "backend";
  }
  if (t.includes("data") || t.includes("schema") || t.includes("database")) {
    return "database";
  }
  if (t.includes("test")) return "testing";
  if (t.includes("readme") || t.includes("doc")) return "documentation";
  return "backend";
}

export function generateTasks(
  project: Project,
  requirements: Requirement[],
): Task[] {
  const approved = requirements.filter((r) => r.approvalStatus === "approved");
  const focus = approved[2]?.text ?? approved[0]?.text ?? project.description;

  const drafts: Omit<Task, "id" | "projectId" | "order">[] = [
    {
      title: "Define data model",
      description: `Design entities needed for: ${focus}`,
      ownerAgent: "database",
      dependencies: [],
      expectedOutput: "Entity list with key fields and relationships",
      constraints: "Keep storage simple; no secrets in plain text",
      state: "queued",
    },
    {
      title: "Design core API endpoints",
      description: "Specify request/response shapes for the main project flow",
      ownerAgent: "backend",
      dependencies: [],
      expectedOutput: "Endpoint table with methods, inputs, outputs",
      constraints: "Validate input at system boundaries",
      state: "queued",
    },
    {
      title: "Sketch primary UI screens",
      description: "Map user flow screens for idea → plan → review",
      ownerAgent: "frontend",
      dependencies: [],
      expectedOutput: "Screen list with purpose and key controls",
      constraints: "Practical student tool UI; clear approval actions",
      state: "queued",
    },
    {
      title: "Wire UI to API contract",
      description: "Connect screens to backend contracts and loading states",
      ownerAgent: "frontend",
      dependencies: [],
      expectedOutput: "UI↔API mapping and empty/error states",
      constraints: "No automatic deployment from UI",
      state: "queued",
    },
    {
      title: "Implement server handlers",
      description: "Plan server logic for creating/updating project artifacts",
      ownerAgent: "backend",
      dependencies: [],
      expectedOutput: "Handler outline with failure/retry notes",
      constraints: "Retry once on timeout; surface review issues to manager",
      state: "queued",
    },
    {
      title: "Create testing checklist",
      description: "Acceptance checks for the project and reviewer walkthrough",
      ownerAgent: "testing",
      dependencies: [],
      expectedOutput: "Prioritized test checklist",
      constraints: "Cover approvals, review issues, and revision loop",
      state: "queued",
    },
    {
      title: "Draft README / write-up",
      description: "Document setup, workflow, agents, and evaluation metrics",
      ownerAgent: "documentation",
      dependencies: [],
      expectedOutput: "README outline with run steps",
      constraints: "Warn before sensitive uploads; no API keys in repo",
      state: "queued",
    },
  ];

  const tasks: Task[] = drafts.map((d, index) => ({
    ...d,
    id: uid("task"),
    projectId: project.id,
    order: index + 1,
    ownerAgent: d.ownerAgent || pickOwner(d.title),
  }));

  // Dependency ordering: data → api → ui wire → server → test/docs
  const byTitle = Object.fromEntries(tasks.map((t) => [t.title, t.id]));
  const dependsOn: Record<string, string[]> = {
    "Design core API endpoints": [byTitle["Define data model"]],
    "Wire UI to API contract": [byTitle["Sketch primary UI screens"], byTitle["Design core API endpoints"]],
    "Implement server handlers": [byTitle["Define data model"], byTitle["Design core API endpoints"]],
    "Create testing checklist": [byTitle["Wire UI to API contract"], byTitle["Implement server handlers"]],
    "Draft README / write-up": [byTitle["Create testing checklist"]],
  };
  return tasks.map((t) => {
    const dependencies = dependsOn[t.title];
    // Preserved from the original plan: the API task starts queued, the rest blocked.
    return dependencies ? { ...t, dependencies, state: t.title === "Design core API endpoints" ? "queued" : "blocked" } : t;
  });
}

/** Pace of one simulated specialist step in demo mode. Tests pass their own `stepMs`. */
export const DEMO_STEP_MS = 1500;

/** Resolves after `ms`; rejects with an AbortError as soon as `signal` aborts (Stop button). */
export function demoPause(ms = DEMO_STEP_MS, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException("Stopped", "AbortError"));
    const onAbort = () => { clearTimeout(timer); reject(new DOMException("Stopped", "AbortError")); };
    const timer = setTimeout(() => { signal?.removeEventListener("abort", onAbort); resolve(); }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

// Deterministic so every demo run looks the same: the testing specialist always
// times out once (retry handling is visible), confidence is fixed per role, and the
// retried output is less confident so the Review Agent has something to flag.
const CONFIDENCE_BY_ROLE: Partial<Record<AgentRole, number>> = {
  database: 0.9,
  backend: 0.86,
  frontend: 0.84,
  testing: 0.88,
  documentation: 0.87,
};
const RETRIED_CONFIDENCE = 0.72;

export type AgentRunOptions = {
  /** Called when the first attempt times out, before the retry starts. */
  onRetry?: (attempt: number) => void;
  stepMs?: number;
  signal?: AbortSignal;
};

export async function runAgentWithRetry(
  task: Task,
  project: Project,
  options: AgentRunOptions = {},
): Promise<AgentOutput> {
  const stepMs = options.stepMs ?? DEMO_STEP_MS;
  const forcedTimeout = task.ownerAgent === "testing";
  let attempt = 0;
  if (forcedTimeout) {
    await demoPause(stepMs, options.signal);
    attempt = 1;
    options.onRetry?.(attempt);
  }
  await demoPause(stepMs, options.signal);

  const role = task.ownerAgent;
  const confidence = attempt > 0 ? RETRIED_CONFIDENCE : CONFIDENCE_BY_ROLE[role] ?? 0.8;

  return {
    id: uid("out"),
    taskId: task.id,
    summary: deliverableSummary(task, project),
    assumptions: [
      `Target user is ${project.targetUser}`,
      "The project prioritizes planning over production deployment",
      AGENTS.find((a) => a.role === role)?.capability ?? "specialist capability",
    ],
    blockers: confidence < 0.8 ? ["Needs clearer acceptance criteria from user"] : [],
    confidence,
    nextSteps: deliverableNextSteps(role),
    retryCount: attempt,
    approved: "pending",
  };
}

/** Demo-mode revision: rewrite the previous deliverable for the feedback, in the specialist's own terms. */
export function reviseAgentOutput(task: Task, previous: AgentOutput, feedback: string): AgentOutput {
  return {
    ...previous,
    summary: revisedSummary(task, previous, feedback),
    blockers: [],
    confidence: Math.max(previous.confidence, 0.8),
    nextSteps: ["Review the revision against the requested criteria", "Request user approval before major changes"],
    approved: "pending",
  };
}

export function reviewOutputs(
  outputs: AgentOutput[],
  tasks: Task[],
): { reviews: Review[]; conflictSummary: string | null } {
  const reviews: Review[] = outputs.map((output) => {
    const task = tasks.find((t) => t.id === output.taskId);
    const missing: string[] = [];
    const conflicts: string[] = [];
    const suggestions: string[] = [];

    if (!output.summary || output.summary.length < 20) {
      missing.push("Output summary is too thin");
    }
    if (output.confidence < 0.75) {
      suggestions.push("Ask user to clarify acceptance criteria");
    }
    if (output.blockers.length > 0) {
      missing.push(...output.blockers);
    }
    if (task?.ownerAgent === "frontend" && !output.summary.toLowerCase().includes("ui")) {
      conflicts.push("Frontend output may not address UI concerns");
    }
    if (task?.ownerAgent === "backend" && output.summary.toLowerCase().includes("schema only")) {
      conflicts.push("Backend output may not match API expectations");
    }

    // Cross-output review issue: docs vs testing coverage mention
    const testingOut = outputs.find((o) =>
      tasks.find((t) => t.id === o.taskId)?.ownerAgent === "testing",
    );
    if (
      task?.ownerAgent === "documentation" &&
      testingOut &&
      !output.summary.toLowerCase().includes("test")
    ) {
      conflicts.push(
        "Documentation outline does not reference the testing checklist",
      );
      suggestions.push("Add a Testing section linking to the checklist");
    }

    let result: Review["result"] = "pass";
    if (conflicts.length > 0) result = "conflict";
    else if (missing.length > 0) result = "flagged";

    return {
      id: uid("rev"),
      outputId: output.id,
      result,
      missingItems: missing,
      conflicts,
      suggestions,
    };
  });

  const conflictItems = reviews.flatMap((r) => r.conflicts);
  const conflictSummary =
    conflictItems.length > 0
      ? `Manager review summary: ${conflictItems.join("; ")}`
      : null;

  return { reviews, conflictSummary };
}
