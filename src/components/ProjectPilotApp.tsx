"use client";

import {
  FeedbackScreen,
  FinalScreen,
  BoardScreen,
  ReviewScreen,
} from "@/components/screens-late";
import {
  IdeaScreen,
  QuestionsScreen,
  RequirementsScreen,
  TasksScreen,
} from "@/components/screens-early";
import {
  ManagerPanel,
  MetricsPanel,
  SecurityBanner,
  WorkflowStepper,
} from "@/components/shell";
import { ProjectStoreProvider, useProjectStore } from "@/lib/store";

function ScreenRouter() {
  const { currentStep } = useProjectStore();
  switch (currentStep) {
    case "idea":
      return <IdeaScreen />;
    case "questions":
      return <QuestionsScreen />;
    case "requirements":
      return <RequirementsScreen />;
    case "tasks":
      return <TasksScreen />;
    case "board":
      return <BoardScreen />;
    case "review":
      return <ReviewScreen />;
    case "feedback":
      return <FeedbackScreen />;
    case "final":
      return <FinalScreen />;
    default:
      return <IdeaScreen />;
  }
}

function AppShell() {
  const { reset, currentStep } = useProjectStore();

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pp-bg)] text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:mx-4 focus:my-2 focus:rounded-lg focus:bg-white focus:p-3 focus:text-teal-800">Skip to main content</a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              ProjectPilot AI
            </div>
            <div className="mt-1 text-sm text-slate-600">
              A clear plan for your next student project
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-sm font-semibold text-teal-800">Demo · Mock AI</span>
            {currentStep !== "idea" && (
              <button
                type="button"
                onClick={reset}
                className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-5 sm:px-6">
          <WorkflowStepper />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <SecurityBanner />
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main id="main-content" tabIndex={-1} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <ScreenRouter />
          </main>
          <ManagerPanel />
        </div>
        <MetricsPanel />
      </div>
    </div>
  );
}

export function ProjectPilotApp() {
  return (
    <ProjectStoreProvider>
      <AppShell />
    </ProjectStoreProvider>
  );
}
