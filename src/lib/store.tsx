"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AGENTS, uid } from "./agents";
import {
  buildApprovedSummary,
  computeMetrics,
  createProject,
  generateQuestions,
  generateRequirements,
  generateTasks,
  reviewOutputs,
  runAgentWithRetry,
  topologicalOrder,
} from "./mock-ai";
import type {
  EvaluationMetrics,
  ManagerNote,
  WorkflowStep,
} from "./types";

import { affectedTaskIds, canVisit, invalidateTasks, outputsReady, requirementsReady, validateTasks, type TaskEdit, type WorkflowState } from "./workflow";

type Store = WorkflowState & {
  managerMode: "demo" | "live";
  setManagerMode: (mode: "demo" | "live") => void;
  savedStatus: string;
  hydrated: boolean;
  busy: boolean;
  editRequirement: (id: string, text: string) => void;
  editTask: (id: string, edit: TaskEdit) => string | null;
  approveOutput: (id: string) => void;
  requestRevision: (id: string) => void;
  selectRevisionTasks: (ids: string[]) => void;
  retryTask: (id: string) => Promise<void>;
  skipTask: (id: string) => void;
  canNavigate: (step: WorkflowStep) => boolean;
  busyLabel: string;
  startProject: (idea: string, targetUser: string) => void;
  startDemoProject: () => void;
  updateAnswer: (questionId: string, answer: string) => void;
  submitAnswers: () => void;
  toggleRequirement: (id: string, status: "approved" | "rejected") => void;
  approveRequirements: () => void;
  approveTaskPlan: () => Promise<void>;
  approveOutputs: () => void;
  submitFeedback: (text: string) => Promise<void>;
  skipFeedback: () => void;
  setUsefulness: (score: number) => void;
  ackSensitiveUpload: () => void;
  reset: () => void;
  goTo: (step: WorkflowStep) => void;
};

const emptyMetrics: EvaluationMetrics = {
  userAcceptanceRate: 0,
  numberOfRevisions: 0,
  taskCompletionRate: 0,
  conflictRate: 0,
  planningTimeSavedMinutes: 0,
  usefulnessScore: 7,
};

function makeNote(step: WorkflowStep, message: string): ManagerNote {
  return {
    id: uid("note"),
    at: new Date().toLocaleTimeString(),
    step,
    message,
  };
}

function withNote(
  notes: ManagerNote[],
  step: WorkflowStep,
  message: string,
): ManagerNote[] {
  return [makeNote(step, message), ...notes].slice(0, 12);
}

function initialState(): WorkflowState {
  return {
    project: {
      id: "",
      title: "",
      description: "",
      targetUser: "",
      approvedSummary: "",
      status: "draft",
      createdAt: "",
    },
    questions: [],
    requirements: [],
    tasks: [],
    agents: AGENTS,
    outputs: [],
    reviews: [],
    feedbackItems: [],
    managerNotes: [],
    metrics: emptyMetrics,
    currentStep: "idea",
    planApproved: false,
    sensitiveUploadAck: false,
    startedAt: Date.now(),
    conflictSummary: null,
    staleTaskIds: [],
    revisionTaskIds: [],
    skippedTaskIds: [],
    workflowNotice: null,
  };
}

const ProjectStoreContext = createContext<Store | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [state, renderState] = useState<WorkflowState>(initialState);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [managerMode, changeManagerMode] = useState<"demo" | "live">("demo");
  const [savedStatus, setSavedStatus] = useState("Loading saved progress…");
  const [hydrated, setHydrated] = useState(false);
  const modeRef = useRef<"demo" | "live">("demo");
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  // Update the snapshot in event handlers, never during render. Async actions and
  // rapid clicks now share the same guarded state as the rendered UI.
  const setState = useCallback((change: WorkflowState | ((s: WorkflowState) => WorkflowState)) => {
    const next = typeof change === "function" ? change(stateRef.current) : change;
    stateRef.current = next;
    renderState(next);
  }, []);

  // Defer browser storage hydration until after the first client render.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem("projectpilot-v2");
        if (raw) {
          const saved = JSON.parse(raw);
          const restored = { ...initialState(), ...saved.state } as WorkflowState;
          if (saved.version !== 2 || typeof restored.project?.id !== "string" || !["idea", "questions", "requirements", "tasks", "board", "review", "feedback", "final"].includes(restored.currentStep)) throw new Error("Invalid save");
          for (const field of ["questions", "requirements", "tasks", "agents", "outputs", "reviews", "feedbackItems", "managerNotes", "staleTaskIds", "revisionTaskIds", "skippedTaskIds"] as const) {
            if (!Array.isArray(restored[field])) throw new Error("Invalid saved collection");
          }
          if (validateTasks(restored.tasks)) throw new Error("Invalid task plan");
          restored.tasks = restored.tasks.map((t) => (t.state === "in_progress" || (restored.project.status === "revising" && restored.revisionTaskIds.includes(t.id))) ? { ...t, state: "failed" } : t);
          restored.agents = AGENTS;
          if (["agents_running", "revising"].includes(restored.project.status)) {
            restored.project = { ...restored.project, status: "review_pending" };
            restored.currentStep = "board";
            restored.workflowNotice = "An interrupted run was restored. Retry unfinished tasks; completed outputs are preserved.";
          }
          setState(restored);
          const mode = saved.mode === "live" ? "live" : "demo";
          modeRef.current = mode;
          changeManagerMode(mode);
        }
        setSavedStatus("Progress saved on this browser");
      } catch {
        setSavedStatus("Saved progress could not be loaded. This session can still be used.");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setState]);

  useEffect(() => {
    if (!hydrated) return;
    let message = "Progress saved on this browser";
    try {
      localStorage.setItem("projectpilot-v2", JSON.stringify({ version: 2, state, mode: managerMode }));
    } catch {
      message = "Saving unavailable. Keep this tab open and export your completed plan.";
    }
    const timer = window.setTimeout(() => setSavedStatus(message), 0);
    return () => window.clearTimeout(timer);
  }, [state, managerMode, hydrated]);

  const setManagerMode = useCallback((mode: "demo" | "live") => {
    if (busyRef.current || stateRef.current.project.id) return;
    modeRef.current = mode;
    changeManagerMode(mode);
  }, []);

  const managerRequest = useCallback(async (stage: string, context: unknown) => {
    busyRef.current = true;
    setBusy(true);
    setBusyLabel(`Manager: generating ${stage}…`);
    try {
      const response = await fetch("/api/manager", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, context }), signal: AbortSignal.timeout(65000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Manager request failed. Try again.");
      return result.items;
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyLabel("");
    }
  }, []);

  const reportManagerError = useCallback((error: unknown) => {
    setState((s) => ({ ...s, workflowNotice: error instanceof Error ? `${error.message} Your input is preserved. Use the same button to retry.` : "Manager unavailable. Your input is preserved; retry when ready." }));
  }, [setState]);

  const startProject = useCallback((idea: string, targetUser: string) => {
    if (busyRef.current || stateRef.current.project.id) return;
    const project = createProject(idea, targetUser);
    if (modeRef.current === "live") {
      void managerRequest("questions", { project }).then((questions) => {
        setState({ ...initialState(), project, questions, currentStep: "questions", startedAt: Date.now(), managerNotes: [makeNote("questions", "Live manager drafted clarifying questions.")] });
      }).catch(reportManagerError);
      return;
    }
    const questions = generateQuestions(idea);
    setState({
      ...initialState(),
      project,
      questions,
      currentStep: "questions",
      startedAt: Date.now(),
      managerNotes: [
        makeNote(
          "questions",
          "Manager: Idea received. Asking clarifying questions before drafting requirements.",
        ),
      ],
    });
  }, [setState, managerRequest, reportManagerError]);

  const startDemoProject = useCallback(() => {
    const idea =
      "An AI project workspace where a Manager Agent breaks a small software project into tasks, assigns frontend, backend, database, testing, and documentation agents, reviews their outputs, and asks the student for approval before major changes.";
    const targetUser =
      "CSE students building small class projects with one shared workspace";
    if (busyRef.current || stateRef.current.project.id) return;
    modeRef.current = "demo";
    changeManagerMode("demo");
    const project = createProject(idea, targetUser);
    const demoAnswers: Record<string, string> = {
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
    const questions = generateQuestions(idea).map((q) => ({
      ...q,
      answer: demoAnswers[q.prompt] ?? "Keep the project focused and ready to present.",
    }));
    const requirements = generateRequirements(project, questions);

    setState({
      ...initialState(),
      project: { ...project, status: "requirements_pending" },
      questions,
      requirements,
      currentStep: "requirements",
      startedAt: Date.now(),
      managerNotes: [
        makeNote(
          "requirements",
          "Manager: Guided project loaded with clarifying answers. Review requirements before task breakdown.",
        ),
      ],
    });
  }, [setState]);

  const updateAnswer = useCallback((questionId: string, answer: string) => {
    if (busyRef.current || stateRef.current.requirements.length) return;
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === questionId ? { ...q, answer } : q,
      ),
    }));
  }, [setState]);

  const submitAnswers = useCallback(() => {
    if (busyRef.current || !stateRef.current.project.id || !stateRef.current.questions.length) return;
    if (stateRef.current.requirements.length) {
      setState((s) => ({ ...s, currentStep: "requirements" }));
      return;
    }
    if (modeRef.current === "live" && stateRef.current.questions.every((q) => q.answer.trim())) {
      const snapshot = stateRef.current;
      void managerRequest("requirements", { project: snapshot.project, questions: snapshot.questions }).then((requirements) => {
        setState((s) => ({ ...s, requirements, currentStep: "requirements", project: { ...s.project, status: "requirements_pending" }, workflowNotice: null, managerNotes: withNote(s.managerNotes, "requirements", "Live manager drafted requirements. Review and approve each one.") }));
      }).catch(reportManagerError);
      return;
    }
    setState((s) => {
      const unanswered = s.questions.filter((q) => !q.answer.trim());
      if (unanswered.length > 0) {
        return {
          ...s,
          managerNotes: withNote(
            s.managerNotes,
            "questions",
            `Manager: ${unanswered.length} answer(s) still missing. Please complete them so requirements are complete.`,
          ),
        };
      }
      const requirements = generateRequirements(s.project, s.questions);
      return {
        ...s,
        requirements,
        project: { ...s.project, status: "requirements_pending" },
        currentStep: "requirements",
        managerNotes: withNote(
          s.managerNotes,
          "requirements",
          "Manager: Clarifications look complete. Drafted requirements for your approval.",
        ),
      };
    });
  }, [setState, managerRequest, reportManagerError]);

  const editRequirement = useCallback((id: string, text: string) => {
    if (busyRef.current || !text.trim()) return;
    setState((s) => {
      const requirement = s.requirements.find((r) => r.id === id);
      if (!requirement || requirement.text === text.trim()) return s;
      const next = invalidateTasks(s, s.tasks.map((t) => t.id));
      return {
        ...next,
        requirements: s.requirements.map((r) => r.id === id ? { ...r, text: text.trim(), approvalStatus: "pending" } : r),
        project: { ...s.project, status: "requirements_pending" },
        currentStep: "requirements",
        workflowNotice: s.tasks.length ? "Requirement changed. Review the preserved task plan after approving requirements; all tasks share this context and their outputs need refreshing." : "Requirement saved. Approve it again before continuing.",
      };
    });
  }, [setState]);

  const toggleRequirement = useCallback((id: string, status: "approved" | "rejected") => {
    if (busyRef.current) return;
    setState((s) => {
      const requirement = s.requirements.find((r) => r.id === id);
      if (!requirement || requirement.approvalStatus === status) return s;
      const next = requirement.approvalStatus === "approved"
        ? invalidateTasks(s, s.tasks.map((t) => t.id)) : s;
      return {
        ...next,
        requirements: s.requirements.map((r) => r.id === id ? { ...r, approvalStatus: status } : r),
        project: { ...s.project, status: "requirements_pending" },
        currentStep: "requirements",
      };
    });
  }, [setState]);

  const approveRequirements = useCallback(() => {
    if (busyRef.current) return;
    const snapshot = stateRef.current;
    if (modeRef.current === "live" && requirementsReady(snapshot) && !snapshot.tasks.length) {
      void managerRequest("tasks", { project: snapshot.project, requirements: snapshot.requirements }).then((tasks) => {
        const error = validateTasks(tasks);
        if (error || !tasks.length) throw new Error(error || "Manager returned an empty plan.");
        setState((s) => ({ ...s, tasks: topologicalOrder(tasks), currentStep: "tasks", workflowNotice: null, project: { ...s.project, status: "tasks_pending", approvedSummary: buildApprovedSummary(s.project, s.requirements, tasks) } }));
      }).catch(reportManagerError);
      return;
    }
    setState((s) => {
      if (!requirementsReady(s)) return s;
      // Revisit without replacing IDs, edits, existing outputs, or approvals.
      const tasks = s.tasks.length ? s.tasks : topologicalOrder(generateTasks(s.project, s.requirements));
      return {
        ...s, tasks, currentStep: "tasks",
        project: { ...s.project, status: s.project.status === "requirements_pending" ? "tasks_pending" : s.project.status,
          approvedSummary: buildApprovedSummary(s.project, s.requirements, tasks) },
          workflowNotice: s.staleTaskIds.length ? "Review the updated requirements against this task plan. Existing tasks are preserved; approval will refresh affected outputs." : null,
      };
    });
  }, [setState, managerRequest, reportManagerError]);

  const editTask = useCallback((id: string, edit: TaskEdit): string | null => {
    const s = stateRef.current;
    if (busyRef.current || s.planApproved || !requirementsReady(s)) return "Task editing is available before plan approval.";
    const task = s.tasks.find((t) => t.id === id);
    if (!task) return "Task not found.";
    const updated = { ...task, ...edit, title: edit.title.trim(), description: edit.description.trim(), dependencies: [...new Set(edit.dependencies)] };
    const tasks = s.tasks.map((t) => t.id === id ? updated : t);
    const error = validateTasks(tasks);
    if (error) return error;
    if (JSON.stringify(task) === JSON.stringify(updated)) return null;
    const affected = affectedTaskIds(tasks, [id]);
    setState({ ...invalidateTasks({ ...s, tasks: topologicalOrder(tasks) }, affected),
      project: { ...s.project, status: "tasks_pending" },
      workflowNotice: "Task saved. The plan still needs your approval; only this task and its dependents will be refreshed.",
    });
    return null;
  }, [setState]);

  // Use the existing single-agent runner so failures and retries are isolated.
  // No generator changes or backend execution infrastructure are needed.
  const executeTasks = useCallback(async (onlyId?: string) => {
    const snapshot = stateRef.current;
    if (busyRef.current || !requirementsReady(snapshot) || !snapshot.tasks.length || validateTasks(snapshot.tasks)) return;
    if (onlyId) {
      const task = snapshot.tasks.find((t) => t.id === onlyId);
      if (!snapshot.planApproved || task?.state !== "failed" || task.dependencies.some((id) => snapshot.tasks.find((t) => t.id === id)?.state !== "completed")) return;
    } else if (snapshot.project.status === "requirements_pending") return;
    busyRef.current = true;
    setBusy(true);
    setBusyLabel("Running assigned agents…");
    setState((s) => ({ ...s, planApproved: true, currentStep: "board",
      project: { ...s.project, status: "agents_running" }, workflowNotice: null,
      skippedTaskIds: onlyId ? s.skippedTaskIds.filter((id) => id !== onlyId) : s.skippedTaskIds,
    }));
    try {
      const ordered = topologicalOrder(stateRef.current.tasks);
      for (const candidate of ordered) {
        const s = stateRef.current;
        const task = s.tasks.find((t) => t.id === candidate.id)!;
        if (onlyId && task.id !== onlyId) continue;
        if (!onlyId && (task.state === "completed" || task.state === "failed" || s.skippedTaskIds.includes(task.id))) continue;
        if (task.dependencies.some((id) => s.tasks.find((t) => t.id === id)?.state !== "completed")) {
          setState((prev) => ({ ...prev, tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "blocked" } : t) }));
          continue;
        }
          setBusyLabel(`Agent: ${task.title}`);
        setState((prev) => ({ ...prev,
          tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "in_progress" } : t),
          agents: prev.agents.map((a) => ({ ...a, availability: a.role === task.ownerAgent ? "busy" : "available" })),
        }));
        try {
          const output = await runAgentWithRetry(task, s.project);
          if (output.taskId !== task.id || !output.summary?.trim()) throw new Error("Invalid agent output");
          setState((prev) => ({ ...prev,
            tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "completed" } : t),
            outputs: [...prev.outputs.filter((o) => o.taskId !== task.id), { ...output, approved: "pending" }],
            staleTaskIds: prev.staleTaskIds.filter((id) => id !== task.id),
          }));
        } catch {
          setState((prev) => ({ ...prev,
            tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, state: "failed" } : t),
            workflowNotice: `Execution failed for ${task.title}. Retry this task on the board; successful tasks are preserved.`,
          }));
        }
      }
      setState((s) => {
        const { reviews, conflictSummary } = reviewOutputs(s.outputs, s.tasks);
        const complete = s.tasks.every((t) => t.state === "completed");
        return { ...s, reviews, conflictSummary,
          currentStep: complete ? "review" : "board",
          project: { ...s.project, status: "review_pending" },
          agents: s.agents.map((a) => ({ ...a, availability: "available" })),
          managerNotes: withNote(s.managerNotes, "review", "Agent outputs collected. Each output needs your individual approval."),
        };
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyLabel("");
    }
  }, [setState]);

  const approveTaskPlan = useCallback(() => executeTasks(), [executeTasks]);
  const retryTask = useCallback((id: string) => executeTasks(id), [executeTasks]);
  const skipTask = useCallback((id: string) => {
    if (busyRef.current) return;
    setState((s) => s.tasks.some((t) => t.id === id && t.state === "failed") ? {
      ...s, skippedTaskIds: [...new Set([...s.skippedTaskIds, id])],
      workflowNotice: "Task skipped for now, not completed. Dependents and the final plan remain blocked until it succeeds. You can retry it later.",
    } : s);
  }, [setState]);

  const approveOutput = useCallback((id: string) => {
    if (busyRef.current) return;
    setState((s) => {
      const output = s.outputs.find((o) => o.id === id);
      if (!output || !s.planApproved || !requirementsReady(s) || s.staleTaskIds.includes(output.taskId) || s.tasks.find((t) => t.id === output.taskId)?.state !== "completed") return s;
      return { ...s,
        outputs: s.outputs.map((o) => o.id === id ? { ...o, approved: "approved" } : o),
        revisionTaskIds: s.revisionTaskIds.filter((taskId) => taskId !== output.taskId),
      };
    });
  }, [setState]);

  const requestRevision = useCallback((id: string) => {
    if (busyRef.current) return;
    setState((s) => {
      const output = s.outputs.find((o) => o.id === id);
      if (!output || !s.planApproved || !requirementsReady(s) || s.staleTaskIds.length || s.tasks.find((t) => t.id === output.taskId)?.state !== "completed") return s;
      return { ...s,
        outputs: s.outputs.map((o) => o.id === id ? { ...o, approved: "rejected" } : o),
        revisionTaskIds: [...new Set([...s.revisionTaskIds, output.taskId])],
        project: { ...s.project, status: "feedback_pending" },
        workflowNotice: "Revision requested. Choose Continue to feedback to describe the change; other approvals are preserved.",
      };
    });
  }, [setState]);

  const selectRevisionTasks = useCallback((ids: string[]) => {
    if (busyRef.current) return;
    setState((s) => ({ ...s, revisionTaskIds: [...new Set(ids)].filter((id) => s.outputs.some((o) => o.taskId === id) && s.tasks.find((t) => t.id === id)?.state === "completed" && !s.staleTaskIds.includes(id)) }));
  }, [setState]);

  const approveOutputs = useCallback(() => {
    if (busyRef.current) return;
    setState((s) => {
      if (!s.planApproved || s.staleTaskIds.length || !s.tasks.every((t) => t.state === "completed")) return s;
      if (!outputsReady(s) && !s.outputs.some((o) => o.approved === "rejected")) return s;
      return { ...s, currentStep: "feedback", project: { ...s.project, status: "feedback_pending" }, workflowNotice: null };
    });
  }, [setState]);

  const submitFeedback = useCallback(async (text: string) => {
    const s = stateRef.current;
    const selected = s.revisionTaskIds.filter((id) => s.outputs.some((o) => o.taskId === id) && s.tasks.find((t) => t.id === id)?.state === "completed");
    if (busyRef.current || !text.trim() || !selected.length || !s.planApproved || s.staleTaskIds.length) return;
    busyRef.current = true;
    setBusy(true);
    setBusyLabel("Revising selected outputs…");
    const feedback = { id: uid("fb"), projectId: s.project.id, userRequest: text.trim(), affectedTasks: selected, revisionStatus: "open" as const };
    setState({ ...s, tasks: s.tasks.map((t) => selected.includes(t.id) ? { ...t, state: "needs_revision" } : t),
      outputs: s.outputs.map((o) => selected.includes(o.taskId) ? { ...o, approved: "pending" } : o),
      feedbackItems: [feedback, ...s.feedbackItems], project: { ...s.project, status: "revising" },
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 600));
      setState((prev) => {
        const outputs = prev.outputs.map((o) => selected.includes(o.taskId) ? {
          ...o, summary: `${o.summary} Revision requested: "${text.trim()}".`,
          nextSteps: ["Review the revision", "Await explicit human approval"], approved: "pending" as const,
        } : o);
        const tasks = prev.tasks.map((t) => selected.includes(t.id) ? { ...t, state: "completed" as const } : t);
        const { reviews, conflictSummary } = reviewOutputs(outputs, tasks);
        return { ...prev, tasks, outputs, reviews, conflictSummary,
          feedbackItems: prev.feedbackItems.map((f) => f.id === feedback.id ? { ...f, revisionStatus: "applied" } : f),
          revisionTaskIds: [], currentStep: "review", project: { ...prev.project, status: "review_pending" },
          workflowNotice: "Revisions are ready. Review and explicitly approve each revised output; unaffected approvals were preserved.",
          managerNotes: withNote(prev.managerNotes, "review", `Revised ${selected.length} selected output(s). Human review required.`),
        };
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
      setBusyLabel("");
    }
  }, [setState]);

  const skipFeedback = useCallback(() => {
    if (busyRef.current) return;
    setState((s) => !canVisit(s, "review") ? s : outputsReady(s) ? { ...s, revisionTaskIds: [], currentStep: "final",
      project: { ...s.project, status: "complete" }, workflowNotice: null,
    } : { ...s, currentStep: "review", workflowNotice: "Skipping feedback does not approve outputs. Review pending or rejected outputs before finalizing." });
  }, [setState]);

  const setUsefulness = useCallback((score: number) => {
    setState((s) => ({
      ...s,
      metrics: computeMetrics({
        requirements: s.requirements,
        tasks: s.tasks,
        outputs: s.outputs,
        reviews: s.reviews,
        feedbackItems: s.feedbackItems,
        startedAt: s.startedAt,
        usefulnessScore: score,
      }),
    }));
  }, [setState]);

  const ackSensitiveUpload = useCallback(() => {
    setState((s) => ({ ...s, sensitiveUploadAck: true }));
  }, [setState]);

  const reset = useCallback(() => {
    if (!busyRef.current) setState(initialState());
  }, [setState]);

  const goTo = useCallback((step: WorkflowStep) => {
    if (busyRef.current) return;
    setState((s) => canVisit(s, step) ? { ...s, currentStep: step } : s);
  }, [setState]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      managerMode, setManagerMode, savedStatus, hydrated,
      metrics: computeMetrics({ ...state, usefulnessScore: state.metrics.usefulnessScore }),
      canNavigate: (step) => !busy && canVisit(state, step),
      editRequirement, editTask, approveOutput, requestRevision, selectRevisionTasks, retryTask, skipTask,
      busy,
      busyLabel,
      startProject,
      startDemoProject,
      updateAnswer,
      submitAnswers,
      toggleRequirement,
      approveRequirements,
      approveTaskPlan,
      approveOutputs,
      submitFeedback,
      skipFeedback,
      setUsefulness,
      ackSensitiveUpload,
      reset,
      goTo,
    }),
    [
      state, managerMode, setManagerMode, savedStatus, hydrated,
      editRequirement, editTask, approveOutput, requestRevision, selectRevisionTasks, retryTask, skipTask,
      busy,
      busyLabel,
      startProject,
      startDemoProject,
      updateAnswer,
      submitAnswers,
      toggleRequirement,
      approveRequirements,
      approveTaskPlan,
      approveOutputs,
      submitFeedback,
      skipFeedback,
      setUsefulness,
      ackSensitiveUpload,
      reset,
      goTo,
    ],
  );

  return (
    <ProjectStoreContext.Provider value={value}>
      {children}
    </ProjectStoreContext.Provider>
  );
}

export function useProjectStore() {
  const ctx = useContext(ProjectStoreContext);
  if (!ctx) throw new Error("useProjectStore must be used within provider");
  return ctx;
}
