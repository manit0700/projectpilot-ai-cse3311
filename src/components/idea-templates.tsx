"use client";

export interface IdeaTemplate {
  id: string;
  label: string;
  idea: string;
  targetUser: string;
}

export const IDEA_TEMPLATES: IdeaTemplate[] = [
  {
    id: "crud",
    label: "CRUD web app",
    idea: "A web app where students create, edit, search and delete study-group sessions, with a simple list view, a detail page and form validation.",
    targetUser: "University students organising study groups",
  },
  {
    id: "api",
    label: "REST API",
    idea: "A REST API for a small library system with endpoints to manage books, members and loans, token authentication, input validation and automated tests.",
    targetUser: "Developers and teaching assistants who integrate the library service",
  },
  {
    id: "mobile",
    label: "Mobile app",
    idea: "A mobile app that lets students log daily habits, set reminders and see weekly streaks, with offline storage and a clean one-hand layout.",
    targetUser: "Students building better daily routines",
  },
  {
    id: "ml",
    label: "ML notebook",
    idea: "A machine learning notebook that cleans a public dataset, trains and compares two baseline models, and reports metrics with clear charts and a short written conclusion.",
    targetUser: "Data science students submitting a course project",
  },
  {
    id: "game",
    label: "Small game",
    idea: "A small browser game with a score system, three difficulty levels, keyboard and touch controls, and a local high-score table.",
    targetUser: "Casual players and classmates playing during breaks",
  },
];

export function TemplateChips({ onPick }: { onPick: (template: IdeaTemplate) => void }) {
  return (
    <div className="mt-3 min-w-0 sm:mt-4">
      <p id="idea-templates-label" className="sr-only text-sm font-semibold text-slate-800 dark:text-slate-100 sm:not-sr-only">Or start from an example</p>
      <ul aria-labelledby="idea-templates-label" className="-mx-1 min-w-0 sm:mt-1.5 flex gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible">
        {IDEA_TEMPLATES.map((template) => (
          <li key={template.id} className="shrink-0">
            <button
              type="button"
              onClick={() => onPick(template)}
              className="min-h-11 whitespace-nowrap rounded-full border border-violet-300 bg-white/80 px-4 py-2 text-sm font-medium text-violet-900 transition hover:border-violet-500 hover:bg-violet-50 dark:border-violet-800 dark:bg-slate-950/70 dark:text-violet-100 dark:hover:bg-violet-950"
            >
              {template.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
