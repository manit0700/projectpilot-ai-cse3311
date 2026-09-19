import type { Agent, AgentRole } from "./types";

export const AGENTS: Agent[] = [
  {
    id: "agent-manager",
    role: "manager",
    capability: "Coordinates context, tasks, dependencies, and approvals",
    availability: "available",
  },
  {
    id: "agent-frontend",
    role: "frontend",
    capability: "UI screens, components, and client interactions",
    availability: "available",
  },
  {
    id: "agent-backend",
    role: "backend",
    capability: "API routes, auth boundaries, and server logic",
    availability: "available",
  },
  {
    id: "agent-database",
    role: "database",
    capability: "Data model, storage, and query design",
    availability: "available",
  },
  {
    id: "agent-testing",
    role: "testing",
    capability: "Test plans, checklists, and acceptance criteria",
    availability: "available",
  },
  {
    id: "agent-docs",
    role: "documentation",
    capability: "README, write-ups, and setup guides",
    availability: "available",
  },
  {
    id: "agent-review",
    role: "review",
    capability: "Consistency checks, conflicts, and missing pieces",
    availability: "available",
  },
];

export const AGENT_LABELS: Record<AgentRole, string> = {
  manager: "Manager Agent",
  frontend: "Frontend Agent",
  backend: "Backend Agent",
  database: "Database Agent",
  testing: "Testing Agent",
  documentation: "Documentation Agent",
  review: "Review Agent",
};

export const WORKFLOW_STEPS = [
  { id: "idea", label: "Idea" },
  { id: "questions", label: "Clarify" },
  { id: "requirements", label: "Requirements" },
  { id: "tasks", label: "Tasks" },
  { id: "board", label: "Agents" },
  { id: "review", label: "Review" },
  { id: "feedback", label: "Feedback" },
  { id: "final", label: "Final Plan" },
] as const;

export function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
