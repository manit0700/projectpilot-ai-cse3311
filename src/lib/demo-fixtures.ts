import type { ClarifyingQuestion } from "./types";

// Prepared content for the guided demo. The demo stops on the Clarify step with
// these answers pre-filled so the audience sees every manager decision.
export const DEMO_IDEA =
  "An AI project workspace where a Manager Agent breaks a small software project into tasks, assigns frontend, backend, database, testing, and documentation agents, reviews their outputs, and asks the student for approval before major changes.";

export const DEMO_TARGET_USER = "CSE students building small class projects with one shared workspace";

export const DEMO_ANSWERS: Record<string, string> = {
  "Who is the primary user of this project?":
    "A student developer who needs help turning a class project idea into an organized implementation plan.",
  "What is the most important feature for your project?":
    "The Manager Agent must split the project into dependency-ordered tasks and assign each task to a specialist agent.",
  "What tech stack constraints do you have (language, host, DB)?":
    "Use a Next.js web app with prepared responses first, then connect a real AI API after the class project is stable.",
  "Do you need login/auth for the first release?":
    "No login for the first release; keep it single-user and focus on planning, approval, and revision flow.",
  "Should the project use a live AI API or prepared responses first?":
    "Prepared responses first so the workflow is reliable, then optional live API integration later.",
};

const DEMO_FALLBACK_ANSWER = "Keep the project focused and ready to present.";

export function prefillDemoAnswers(questions: ClarifyingQuestion[]): ClarifyingQuestion[] {
  return questions.map((q) => ({ ...q, answer: DEMO_ANSWERS[q.prompt] ?? DEMO_FALLBACK_ANSWER, suggested: true }));
}

// Demo-mode drafts: deterministic, derived from the user's own idea and target
// user so a custom idea still gets relevant starting answers without any API.
const DRAFT_RULES: Array<[RegExp, (idea: string, user: string) => string]> = [
  [/primary user|who/i, (_idea, user) => `${user}, who need a simple way to use this without extra setup.`],
  [/most important feature|core/i, (idea) => `The core flow described in the idea: ${firstClause(idea)}.`],
  [/tech stack|language|host/i, () => "Next.js with TypeScript on Vercel, using free tiers and browser storage to keep the first version small."],
  [/login|auth/i, () => "No login for the first release; single-user with data saved in the browser."],
  [/live ai|prepared responses/i, () => "Prepared responses first so the demo is reliable, then an optional live AI API once the flow is stable."],
  [/native|pwa|responsive/i, () => "Responsive web app that works on phone and laptop browsers."],
];

function firstClause(idea: string): string {
  const clause = idea.trim().replace(/\s+/g, " ").split(/[.;]/)[0] ?? "";
  return clause.length > 140 ? `${clause.slice(0, 137)}...` : clause;
}

export function draftDemoAnswers(
  project: { description: string; targetUser: string },
  questions: ClarifyingQuestion[],
): ClarifyingQuestion[] {
  return questions.map((q) => {
    const rule = DRAFT_RULES.find(([pattern]) => pattern.test(q.prompt));
    const answer = rule ? rule[1](project.description, project.targetUser) : `Keep it focused and small: ${firstClause(project.description)}.`;
    return { ...q, answer, suggested: true };
  });
}
