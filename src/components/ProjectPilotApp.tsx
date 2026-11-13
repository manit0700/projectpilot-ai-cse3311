"use client";

import { useEffect, useRef, useState } from "react";
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
import { LIVE_CONSENT_KEY, LiveAccess, toProvider, type LiveProvider } from "./live-access";
import { ExportPanel } from "@/components/export-panel";
import { HeaderBar } from "@/components/header-bar";
import { Shortcuts } from "@/components/shortcuts";
import {
  BottomNavigation,
  ManagerPanel,
  MetricsPanel,
} from "@/components/shell";
import { ProjectStoreProvider, useProjectStore } from "@/lib/store";

const PROVIDER_LABEL: Record<LiveProvider, string> = { openai: "OpenAI", openrouter: "OpenRouter", gemini: "Gemini" };

function consentAccepted(): boolean {
  try { return sessionStorage.getItem(LIVE_CONSENT_KEY) === "1"; } catch { return false; }
}

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

function ExportMenu({ inline }: { inline: boolean }) {
  return (
    <details className={inline ? "" : "relative"}>
      <summary className="flex min-h-11 cursor-pointer items-center rounded-xl border border-slate-300 px-4 text-sm font-medium text-slate-800">Export</summary>
      <div className={inline ? "mt-2" : "absolute right-0 top-full z-30 mt-1 max-h-[70vh] w-[min(34rem,calc(100vw-2rem))] overflow-auto rounded-xl border border-slate-200 bg-white p-2 shadow-lg"}>
        <ExportPanel />
      </div>
    </details>
  );
}

function AppShell() {
  const { currentStep, busy, workflowNotice, managerMode, hydrated, project } = useProjectStore();
  const [liveReady, setLiveReady] = useState(false);
  const [provider, setProvider] = useState<LiveProvider>("openai");
  const [providerConfigured, setProviderConfigured] = useState(false);
  // Demo stays the default for every fresh project; a configured provider only
  // labels the Live option. Live is opt-in and still requires consent.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/manager").then((r) => r.json()).then((config) => {
      if (cancelled) return;
      setProvider(toProvider(config.provider));
      setProviderConfigured(config.configured === true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    if (managerMode !== "live") return;
    let cancelled = false;
    fetch("/api/live-access").then((r) => r.json()).then((result) => {
      // A dev server without an access code reports authenticated; consent is still required.
      if (!cancelled) setLiveReady(result.authenticated === true && consentAccepted());
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [managerMode]);
  const mainRef = useRef<HTMLElement>(null);
  const previousStep = useRef(currentStep);
  useEffect(() => {
    if (previousStep.current !== currentStep) {
      mainRef.current?.focus({ preventScroll: true });
      mainRef.current?.scrollIntoView({ block: "start" });
    }
    previousStep.current = currentStep;
  }, [currentStep]);

  const modeLocked = busy || !!project.id || !hydrated;
  const modeLockReason = !hydrated ? "Loading saved progress." : busy ? "Agents are running." : project.id ? "A project is open. Reset to start a new project in another mode." : null;
  const isLive = managerMode === "live";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--pp-bg)] text-slate-900">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:mx-4 focus:my-2 focus:rounded-lg focus:bg-white focus:p-3 focus:text-teal-800">Skip to main content</a>
      <HeaderBar
        isLive={isLive}
        providerLabel={PROVIDER_LABEL[provider]}
        providerConfigured={providerConfigured}
        modeLocked={modeLocked}
        modeLockReason={modeLockReason}
        onLiveAccess={() => setLiveReady(false)}
        exportSlot={(inline) => <ExportMenu inline={inline} />}
      />
      <Shortcuts />

      <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:px-6 sm:py-8">
        <MetricsPanel />
        <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main ref={mainRef} id="main-content" tabIndex={-1} className="scroll-mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-8">
            {workflowNotice && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">{workflowNotice}</p>}
            {hydrated ? isLive && !liveReady ? <LiveAccess provider={provider} onUnlocked={() => setLiveReady(true)} /> : <><ScreenRouter /><BottomNavigation /></> : <p role="status">Loading saved project…</p>}
          </main>
          <ManagerPanel />
        </div>
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
