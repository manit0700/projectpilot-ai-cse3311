"use client";

import { useEffect, useRef } from "react";
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
  const { reset, currentStep, busy, workflowNotice, managerMode, setManagerMode, savedStatus, hydrated, project } = useProjectStore();
  const mainRef = useRef<HTMLElement>(null);
  const previousStep = useRef(currentStep);
  useEffect(() => {
    if (previousStep.current !== currentStep) {
      mainRef.current?.focus({ preventScroll: true });
      mainRef.current?.scrollIntoView({ block: "start" });
    }
    previousStep.current = currentStep;
  }, [currentStep]);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pp-bg)] text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:mx-4 focus:my-2 focus:rounded-lg focus:bg-white focus:p-3 focus:text-teal-800">Skip to main content</a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="text-2xl font-semibold tracking-tight text-slate-900">
              ProjectPilot AI
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium">Manager mode <select aria-label="Manager mode" value={managerMode} disabled={busy || !!project.id || !hydrated} onChange={(e) => setManagerMode(e.target.value as "demo" | "live")} className="ml-2 rounded-lg border border-slate-300 p-2"><option value="demo">Demo</option><option value="live">Live API</option></select></label>
            {currentStep !== "idea" && (
              <button
                type="button"
                disabled={busy}
                onClick={() => { if (window.confirm("Start over? This clears the current saved project.")) reset(); }}
                className="min-h-11 rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            )}
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 pb-5 sm:px-6">
          <p className="mb-2 text-sm text-slate-600" role="status">{savedStatus} · Specialist agents use prepared demo responses.</p>
          <WorkflowStepper />
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main ref={mainRef} id="main-content" tabIndex={-1} className="scroll-mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            {workflowNotice && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">{workflowNotice}</p>}
            {hydrated ? <ScreenRouter /> : <p role="status">Loading saved project…</p>}
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
