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
      <SecurityBanner />
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div>
            <div className="text-lg font-semibold tracking-tight text-slate-900">
              ProjectPilot AI
            </div>
            <div className="text-xs text-slate-500">
              CSE 3311 · student project planner · mock agents ready
            </div>
          </div>
          <div className="flex items-center gap-2">
            {currentStep !== "idea" && (
              <button
                type="button"
                onClick={reset}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-3">
          <WorkflowStepper />
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl flex-1 grid-cols-1 lg:grid-cols-[1fr_280px]">
        <main className="px-4 py-6">
          <ScreenRouter />
        </main>
        <div className="hidden lg:block">
          <ManagerPanel />
        </div>
      </div>

      <div className="border-t border-slate-200 lg:hidden">
        <div className="max-h-48 overflow-y-auto">
          <ManagerPanel />
        </div>
      </div>

      <MetricsPanel />
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
