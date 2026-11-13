import type { Priority } from "./types";

// Deterministic Given/When/Then acceptance criteria for Demo mode, derived only from the
// requirement's own text and priority (must: 3, should: 2, could: 1). No model call.

export const MAX_ACCEPTANCE = 4;

const words = (text: string, count: number) => {
  const all = text.replace(/\s+/g, " ").trim().replace(/[.:;]+$/, "").split(" ");
  return all.length > count ? `${all.slice(0, count).join(" ")}...` : all.join(" ");
};

const SPECIFIC: Array<[RegExp, string]> = [
  [/approval|approve/i, "Given an agent output is waiting, When the user has not approved it, Then it is not treated as final or used downstream"],
  [/deploy/i, "Given the plan is finished, When a repo or deploy action is proposed, Then it runs only after the user explicitly confirms"],
  [/test|readme/i, "Given the final plan is opened, When a reviewer looks for checks, Then a testing checklist and README are included"],
  [/auth|login/i, "Given a first-time visitor, When they open the app, Then the login decision recorded here is applied without extra steps"],
  [/stack|constraint/i, "Given the planned tasks, When they are read together, Then none requires a tool outside the stated stack"],
  [/target users|serve/i, "Given the target user opens the result, When they follow it without help, Then each step is understandable to them"],
];

export function acceptanceFor(text: string, priority: Priority): string[] {
  const count = priority === "must" ? 3 : priority === "should" ? 2 : 1;
  const criteria = [
    "Given the plan is finished, When a reviewer checks it against this requirement, Then the delivered work visibly covers it",
    SPECIFIC.find(([pattern]) => pattern.test(text.slice(0, 80)))?.[1] ?? `Given this requirement is approved, When tasks are generated, Then at least one task delivers "${words(text, 6)}"`,
    "Given a gap is found, When the Review Agent checks this requirement, Then the gap is listed as a finding before approval",
  ];
  return criteria.slice(0, Math.min(count, MAX_ACCEPTANCE));
}
