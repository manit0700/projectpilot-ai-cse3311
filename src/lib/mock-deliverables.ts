import type { AgentOutput, AgentRole, Project, Task } from "./types";

// Prepared specialist deliverables for demo mode. Each is a short structured
// artifact (4-6 lines) matching the task's expected output, never a status line.
// The Review Agent heuristics expect "UI" in frontend output and a Testing
// section in documentation output; keep those words when editing.

const lines = (...rows: string[]) => rows.join("\n");

function databaseDeliverable(task: Task, project: Project): string {
  return lines(
    `Data model for "${task.title}" (${project.title}):`,
    "- Project: id, title, description, targetUser, status, createdAt",
    "- Requirement: id, projectId (FK Project), text, priority, approvalStatus",
    "- Task: id, projectId (FK Project), title, ownerAgent, dependencies[], state, order",
    "- AgentOutput: id, taskId (FK Task), summary, confidence, approved; Review: id, outputId (FK AgentOutput), result",
    "Relationships: Project 1-n Requirement and Task; Task 1-1 AgentOutput; AgentOutput 1-1 Review. No secrets stored.",
  );
}

function backendDeliverable(task: Task): string {
  if (/handler|server/i.test(task.title)) {
    return lines(
      `Server handler outline for "${task.title}":`,
      "- createProject(idea, targetUser): validate length >= 12, persist Project, return clarifying questions",
      "- approveRequirements(ids): reject if any requirement pending; emit tasks in dependency order",
      "- runTask(taskId): require completed prerequisites; one retry on timeout; mark failed with reason",
      "- submitReview(outputIds): one review per output; conflicts block approval",
      "Failure handling: 400 for invalid input, 502 with a sanitized message for upstream errors; no automatic deploys.",
    );
  }
  return lines(
    `API contract for "${task.title}":`,
    "| POST /api/projects | idea, targetUser | project + clarifying questions |",
    "| POST /api/projects/:id/requirements | answers[] | requirements[] (pending) |",
    "| POST /api/projects/:id/tasks | approved requirement ids | tasks[] with dependencies |",
    "| POST /api/tasks/:id/run | none | agent output (pending approval) |",
    "Validation at the boundary: body under 60 KB, approved requirements before task generation, origin check on every POST.",
  );
}

function frontendDeliverable(task: Task): string {
  if (/wire|contract|api/i.test(task.title)) {
    return lines(
      `UI to API mapping for "${task.title}":`,
      "- Idea screen -> POST /api/projects; disabled Start until idea has 12+ characters",
      "- Clarify screen -> POST /requirements; shows per-question help text and a busy label",
      "- Task board -> POST /tasks/:id/run; cards move queued -> in progress -> completed or failed",
      "- Review screen -> approve or request revision per output; export disabled until all approved",
      "Empty and error states: 'No tasks yet' placeholder; failed card shows reason with Retry and Skip.",
    );
  }
  return lines(
    `UI screen list for "${task.title}":`,
    "1. Idea - project textarea, target user field, Start and Guided demo buttons",
    "2. Clarify - one card per question with why-it-matters text, Continue to requirements CTA",
    "3. Requirements - approve or reject per row; Approve all gate before tasks",
    "4. Agent board - task cards by state, Retry/Skip on failures, Review collected outputs button",
    "5. Review and Final - approve or request revision per output; download Markdown plan",
  );
}

function testingDeliverable(task: Task): string {
  return lines(
    `Testing checklist for "${task.title}" (priority order):`,
    "[ ] Idea under 12 characters is rejected and nothing is created",
    "[ ] Requirements cannot be approved while any row is pending",
    "[ ] Dependent task stays blocked until every prerequisite completes",
    "[ ] Failed specialist can be retried without losing approved outputs",
    "[ ] Export is refused until every output is approved and reviewed",
  );
}

function documentationDeliverable(task: Task): string {
  return lines(
    `README outline for "${task.title}":`,
    "1. Overview - what the Manager Agent does and does not do (no repository writes, no deploys)",
    "2. Setup - npm install, npm run dev, optional API key in .env.local (never committed)",
    "3. Workflow - idea -> clarify -> requirements -> tasks -> agents -> review -> final plan",
    "4. Testing - links to the testing checklist; run npm test before submitting",
    "5. Evaluation - acceptance rate, revision rounds, measured planning time, usefulness rating",
  );
}

export function deliverableSummary(task: Task, project: Project): string {
  switch (task.ownerAgent) {
    case "database": return databaseDeliverable(task, project);
    case "backend": return backendDeliverable(task);
    case "frontend": return frontendDeliverable(task);
    case "testing": return testingDeliverable(task);
    case "documentation": return documentationDeliverable(task);
    default: return `Completed planning for ${task.title}.`;
  }
}

const NEXT_STEPS: Partial<Record<AgentRole, string[]>> = {
  database: ["Confirm field names with the Backend Agent before endpoints are finalized"],
  backend: ["Share request and response shapes with the Frontend Agent"],
  frontend: ["Check every screen has a loading, empty and error state"],
  testing: ["Run the checklist against the approved plan before the final write-up"],
  documentation: ["Fill in setup steps once the stack decision is approved"],
};

export function deliverableNextSteps(role: AgentRole): string[] {
  return [...(NEXT_STEPS[role] ?? []), "Request user approval before major changes"];
}

const REVISION_LEAD: Partial<Record<AgentRole, string>> = {
  database: "Revised data model: entity fields and constraints updated for the requested criteria.",
  backend: "Revised API contract: endpoints, validation rules and error responses updated.",
  frontend: "Revised UI plan: screens, controls and empty/error states updated.",
  testing: "Revised testing checklist: added checks for the requested acceptance criteria.",
  documentation: "Revised README outline: Testing and Setup sections updated.",
};

export function revisedSummary(task: Task, previous: AgentOutput, feedback: string): string {
  return lines(REVISION_LEAD[task.ownerAgent] ?? `Revised deliverable for ${task.title}.`, previous.summary, `Revision applied: ${feedback}`);
}
