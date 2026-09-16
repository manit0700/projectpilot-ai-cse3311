import { AGENTS, uid } from "./agents";
import type {
  AgentOutput,
  AgentRole,
  ClarifyingQuestion,
  EvaluationMetrics,
  Feedback,
  Project,
  Requirement,
  Review,
  Task,
} from "./types";

function titleFromIdea(idea: string): string {
  const cleaned = idea.trim().replace(/\s+/g, " ");
  if (cleaned.length <= 48) return cleaned || "Untitled Project";
  return `${cleaned.slice(0, 45)}...`;
}

export function createProject(
  idea: string,
  targetUser: string,
): Project {
  return {
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
      prompt: "What is the must-have feature for a first MVP demo?",
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
      prompt: "Do you need login/auth in the MVP?",
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

  if (lower.includes("ai") || lower.includes("llm") || lower.includes("chat")) {
    base.push({
      id: uid("q"),
      prompt: "Should the MVP use a live AI API or mock responses first?",
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
  const mvp =
    answers["What is the must-have feature for a first MVP demo?"] ||
    "core happy-path flow";
  const auth =
    answers["Do you need login/auth in the MVP?"] || "not specified";
  const stack =
    answers["What tech stack constraints do you have (language, host, DB)?"] ||
    "not specified";

  const texts: { text: string; priority: Requirement["priority"] }[] = [
    {
      text: `Support the project idea: ${project.description}`,
      priority: "must",
    },
    {
      text: `Serve target users: ${project.targetUser}`,
      priority: "must",
    },
    {
      text: `Deliver MVP focus: ${mvp}`,
      priority: "must",
    },
    {
      text: `Respect stack constraints: ${stack}`,
      priority: "should",
    },
    {
      text: `Auth decision for MVP: ${auth}`,
      priority: "should",
    },
    {
      text: "Provide clear human approval checkpoints before major changes",
      priority: "must",
    },
    {
      text: "Include a testing checklist and README for graders/demo",
      priority: "should",
    },
    {
      text: "Do not auto-deploy; require explicit user approval for repo/deploy actions",
      priority: "must",
    },
  ];

  return texts.map((item) => ({
    id: uid("req"),
    projectId: project.id,
    text: item.text,
    priority: item.priority,
    approvalStatus: "pending" as const,
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
      constraints: "Keep MVP storage simple; no secrets in plain text",
      state: "queued",
    },
    {
      title: "Design core API endpoints",
      description: "Specify request/response shapes for the main MVP flow",
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
      constraints: "Retry once on timeout; surface conflicts to manager",
      state: "queued",
    },
    {
      title: "Create testing checklist",
      description: "Acceptance checks for MVP demo and grader walkthrough",
      ownerAgent: "testing",
      dependencies: [],
      expectedOutput: "Prioritized test checklist",
      constraints: "Cover approvals, conflicts, and revision loop",
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
  const withDeps = tasks.map((t) => {
    if (t.title === "Design core API endpoints") {
      return { ...t, dependencies: [byTitle["Define data model"]] };
    }
    if (t.title === "Wire UI to API contract") {
      return {
        ...t,
        dependencies: [
          byTitle["Sketch primary UI screens"],
          byTitle["Design core API endpoints"],
        ],
        state: "blocked" as const,
      };
    }
    if (t.title === "Implement server handlers") {
      return {
        ...t,
        dependencies: [
          byTitle["Define data model"],
          byTitle["Design core API endpoints"],
        ],
        state: "blocked" as const,
      };
    }
    if (t.title === "Create testing checklist") {
      return {
        ...t,
        dependencies: [
          byTitle["Wire UI to API contract"],
          byTitle["Implement server handlers"],
        ],
        state: "blocked" as const,
      };
    }
    if (t.title === "Draft README / write-up") {
      return {
        ...t,
        dependencies: [byTitle["Create testing checklist"]],
        state: "blocked" as const,
      };
    }
    return t;
  });

  return withDeps;
}

function orderedReadyTasks(tasks: Task[]): Task[] {
  const completed = new Set(
    tasks.filter((t) => t.state === "completed").map((t) => t.id),
  );
  return [...tasks]
    .sort((a, b) => a.order - b.order)
    .filter((t) => {
      if (t.state === "completed" || t.state === "failed") return false;
      return t.dependencies.every((d) => completed.has(d));
    });
}

export function topologicalOrder(tasks: Task[]): Task[] {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const visited = new Set<string>();
  const result: Task[] = [];

  function visit(id: string) {
    if (visited.has(id)) return;
    visited.add(id);
    const task = byId[id];
    if (!task) return;
    task.dependencies.forEach(visit);
    result.push(task);
  }

  [...tasks]
    .sort((a, b) => a.order - b.order)
    .forEach((t) => visit(t.id));
  return result;
}

export async function runAgentWithRetry(
  task: Task,
  project: Project,
  attempt = 0,
): Promise<AgentOutput> {
  // Simulate occasional timeout on first attempt for one task type
  const shouldTimeout =
    attempt === 0 && task.ownerAgent === "testing" && Math.random() < 0.35;

  await new Promise((r) => setTimeout(r, 350 + Math.random() * 450));

  if (shouldTimeout) {
    return runAgentWithRetry(task, project, 1);
  }

  const role = task.ownerAgent;
  const summaryByRole: Record<string, string> = {
    frontend: `UI plan for "${task.title}": screens, key controls, and approval CTAs aligned to ${project.title}.`,
    backend: `API plan for "${task.title}": endpoints, validation rules, and timeout/retry handling.`,
    database: `Data model for "${task.title}": entities Project, Requirement, Task, AgentOutput, Review, Feedback.`,
    testing: `Testing checklist for "${task.title}": happy path, approval gates, conflict cases, revision loop.`,
    documentation: `Docs outline for "${task.title}": setup, workflow steps, agent roles, metrics, privacy notes.`,
  };

  const confidence = shouldTimeout
    ? 0.72
    : 0.78 + Math.random() * 0.18;

  return {
    id: uid("out"),
    taskId: task.id,
    summary: summaryByRole[role] ?? `Completed planning for ${task.title}.`,
    assumptions: [
      `Target user is ${project.targetUser}`,
      "MVP prioritizes planning over production deployment",
      AGENTS.find((a) => a.role === role)?.capability ?? "specialist capability",
    ],
    blockers: confidence < 0.8 ? ["Needs clearer acceptance criteria from user"] : [],
    confidence: Number(confidence.toFixed(2)),
    nextSteps: [
      "Wait for manager aggregation",
      "Submit to Review Agent",
      "Request user approval before major changes",
    ],
    retryCount: attempt,
    approved: "pending",
  };
}

export function runAllReadyAgents(
  tasks: Task[],
  project: Project,
  existing: AgentOutput[],
): Promise<{ tasks: Task[]; outputs: AgentOutput[] }> {
  return (async () => {
    let currentTasks = tasks.map((t) => ({ ...t }));
    let outputs = [...existing];
    const maxPasses = currentTasks.length + 2;

    for (let pass = 0; pass < maxPasses; pass++) {
      const ready = orderedReadyTasks(currentTasks).filter(
        (t) => !outputs.some((o) => o.taskId === t.id),
      );
      if (ready.length === 0) break;

      for (const task of ready) {
        currentTasks = currentTasks.map((t) =>
          t.id === task.id ? { ...t, state: "in_progress" as const } : t,
        );
        const output = await runAgentWithRetry(task, project);
        outputs = [...outputs.filter((o) => o.taskId !== task.id), output];
        currentTasks = currentTasks.map((t) =>
          t.id === task.id ? { ...t, state: "completed" as const } : t,
        );
        // Unblock dependents
        currentTasks = currentTasks.map((t) => {
          if (t.state !== "blocked") return t;
          const done = new Set(
            currentTasks.filter((x) => x.state === "completed").map((x) => x.id),
          );
          if (t.dependencies.every((d) => done.has(d))) {
            return { ...t, state: "queued" as const };
          }
          return t;
        });
      }
    }

    return { tasks: currentTasks, outputs };
  })();
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
      conflicts.push("Backend output conflicts with API expectations");
    }

    // Cross-output conflict: docs vs testing coverage mention
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
      ? `Manager conflict summary: ${conflictItems.join("; ")}`
      : null;

  return { reviews, conflictSummary };
}

export function applyFeedback(
  feedbackText: string,
  tasks: Task[],
): Feedback {
  const lower = feedbackText.toLowerCase();
  const affected = tasks
    .filter((t) => {
      if (lower.includes("ui") || lower.includes("frontend")) {
        return t.ownerAgent === "frontend";
      }
      if (lower.includes("api") || lower.includes("backend")) {
        return t.ownerAgent === "backend";
      }
      if (lower.includes("data") || lower.includes("schema")) {
        return t.ownerAgent === "database";
      }
      if (lower.includes("test")) return t.ownerAgent === "testing";
      if (lower.includes("doc") || lower.includes("readme")) {
        return t.ownerAgent === "documentation";
      }
      return t.ownerAgent === "frontend" || t.ownerAgent === "backend";
    })
    .map((t) => t.id);

  return {
    id: uid("fb"),
    projectId: tasks[0]?.projectId ?? uid("proj"),
    userRequest: feedbackText.trim(),
    affectedTasks: affected.length ? affected : tasks.slice(0, 2).map((t) => t.id),
    revisionStatus: "open",
  };
}

export function computeMetrics(input: {
  requirements: Requirement[];
  tasks: Task[];
  outputs: AgentOutput[];
  reviews: Review[];
  feedbackItems: Feedback[];
  startedAt: number;
  usefulnessScore: number;
}): EvaluationMetrics {
  const approvedReqs = input.requirements.filter(
    (r) => r.approvalStatus === "approved",
  ).length;
  const decidedReqs = input.requirements.filter(
    (r) => r.approvalStatus !== "pending",
  ).length;
  const completedTasks = input.tasks.filter((t) => t.state === "completed").length;
  const conflicts = input.reviews.filter((r) => r.result === "conflict").length;
  const elapsedMin = Math.max(
    1,
    Math.round((Date.now() - input.startedAt) / 60000),
  );

  return {
    userAcceptanceRate:
      decidedReqs === 0
        ? 0
        : Number(((approvedReqs / decidedReqs) * 100).toFixed(1)),
    numberOfRevisions: input.feedbackItems.filter(
      (f) => f.revisionStatus === "applied",
    ).length,
    taskCompletionRate:
      input.tasks.length === 0
        ? 0
        : Number(((completedTasks / input.tasks.length) * 100).toFixed(1)),
    conflictRate:
      input.reviews.length === 0
        ? 0
        : Number(((conflicts / input.reviews.length) * 100).toFixed(1)),
    planningTimeSavedMinutes: Math.max(15, 90 - elapsedMin * 5),
    usefulnessScore: input.usefulnessScore,
  };
}

export function buildApprovedSummary(
  project: Project,
  requirements: Requirement[],
  tasks: Task[],
): string {
  const musts = requirements
    .filter((r) => r.priority === "must" && r.approvalStatus === "approved")
    .map((r) => r.text);
  return [
    `Project: ${project.title}`,
    `Users: ${project.targetUser}`,
    `Idea: ${project.description}`,
    `Must-haves: ${musts.join(" | ") || "none listed"}`,
    `Tasks planned: ${tasks.length} (dependency-ordered)`,
  ].join("\n");
}
