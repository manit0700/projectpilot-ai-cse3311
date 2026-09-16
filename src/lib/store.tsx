"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AGENTS, uid } from "./agents";
import {
  applyFeedback,
  buildApprovedSummary,
  computeMetrics,
  createProject,
  generateQuestions,
  generateRequirements,
  generateTasks,
  reviewOutputs,
  runAllReadyAgents,
  topologicalOrder,
} from "./mock-ai";
import type {
  EvaluationMetrics,
  ManagerNote,
  ProjectContext,
  WorkflowStep,
} from "./types";

type Store = ProjectContext & {
  busy: boolean;
  busyLabel: string;
  startProject: (idea: string, targetUser: string) => void;
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

function initialState(): ProjectContext {
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
  };
}

const ProjectStoreContext = createContext<Store | null>(null);

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ProjectContext>(initialState);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const stateRef = useRef(state);
  stateRef.current = state;

  const startProject = useCallback((idea: string, targetUser: string) => {
    const project = createProject(idea, targetUser);
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
  }, []);

  const updateAnswer = useCallback((questionId: string, answer: string) => {
    setState((s) => ({
      ...s,
      questions: s.questions.map((q) =>
        q.id === questionId ? { ...q, answer } : q,
      ),
    }));
  }, []);

  const submitAnswers = useCallback(() => {
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
  }, []);

  const toggleRequirement = useCallback(
    (id: string, status: "approved" | "rejected") => {
      setState((s) => {
        const requirements = s.requirements.map((r) =>
          r.id === id ? { ...r, approvalStatus: status } : r,
        );
        return {
          ...s,
          requirements,
          metrics: computeMetrics({
            requirements,
            tasks: s.tasks,
            outputs: s.outputs,
            reviews: s.reviews,
            feedbackItems: s.feedbackItems,
            startedAt: s.startedAt,
            usefulnessScore: s.metrics.usefulnessScore,
          }),
        };
      });
    },
    [],
  );

  const approveRequirements = useCallback(() => {
    setState((s) => {
      const pending = s.requirements.filter((r) => r.approvalStatus === "pending");
      if (pending.length > 0) {
        return {
          ...s,
          managerNotes: withNote(
            s.managerNotes,
            "requirements",
            "Manager: Approve or reject each requirement before task breakdown.",
          ),
        };
      }
      const approved = s.requirements.filter((r) => r.approvalStatus === "approved");
      if (approved.length === 0) {
        return {
          ...s,
          managerNotes: withNote(
            s.managerNotes,
            "requirements",
            "Manager: All requirements were rejected. Please revise answers or re-approve must-haves.",
          ),
        };
      }
      const tasks = topologicalOrder(generateTasks(s.project, s.requirements));
      return {
        ...s,
        tasks,
        project: {
          ...s.project,
          status: "tasks_pending",
          approvedSummary: buildApprovedSummary(s.project, s.requirements, tasks),
        },
        currentStep: "tasks",
        managerNotes: withNote(
          s.managerNotes,
          "tasks",
          `Manager: Built ${tasks.length} dependency-ordered tasks and assigned specialist agents.`,
        ),
      };
    });
  }, []);

  const approveTaskPlan = useCallback(async () => {
    setBusy(true);
    setBusyLabel("Manager assigning tasks to agents…");

    const snapshot = stateRef.current;
    setState((s) => ({
      ...s,
      planApproved: true,
      project: { ...s.project, status: "agents_running" },
      currentStep: "board",
      agents: s.agents.map((a) =>
        a.role === "manager" ? a : { ...a, availability: "busy" as const },
      ),
      managerNotes: withNote(
        s.managerNotes,
        "board",
        "Manager: Plan approved. Dispatching tasks with shared project context. Timeouts will retry once.",
      ),
    }));

    const { tasks, outputs } = await runAllReadyAgents(
      snapshot.tasks,
      snapshot.project,
      snapshot.outputs,
    );
    const { reviews, conflictSummary } = reviewOutputs(outputs, tasks);

    setState((prev) => ({
      ...prev,
      tasks,
      outputs,
      reviews,
      conflictSummary,
      project: { ...prev.project, status: "review_pending" },
      agents: prev.agents.map((a) => ({
        ...a,
        availability: "available" as const,
      })),
      currentStep: "review",
      metrics: computeMetrics({
        requirements: prev.requirements,
        tasks,
        outputs,
        reviews,
        feedbackItems: prev.feedbackItems,
        startedAt: prev.startedAt,
        usefulnessScore: prev.metrics.usefulnessScore,
      }),
      managerNotes: withNote(
        prev.managerNotes,
        "review",
        conflictSummary
          ? conflictSummary
          : "Manager: Agent outputs collected. Review Agent found no hard conflicts.",
      ),
    }));
    setBusy(false);
    setBusyLabel("");
  }, []);

  const approveOutputs = useCallback(() => {
    setState((s) => ({
      ...s,
      outputs: s.outputs.map((o) => ({ ...o, approved: "approved" as const })),
      project: { ...s.project, status: "feedback_pending" },
      currentStep: "feedback",
      managerNotes: withNote(
        s.managerNotes,
        "feedback",
        "Manager: Outputs approved. Share feedback for revisions, or continue to the final plan.",
      ),
    }));
  }, []);

  const submitFeedback = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setBusy(true);
    setBusyLabel("Manager updating affected tasks…");

    const s = stateRef.current;
    const feedback = applyFeedback(text, s.tasks);
    const tasksMarked = s.tasks.map((t) =>
      feedback.affectedTasks.includes(t.id)
        ? { ...t, state: "needs_revision" as const }
        : t,
    );

    setState({
      ...s,
      tasks: tasksMarked,
      feedbackItems: [feedback, ...s.feedbackItems],
      project: { ...s.project, status: "revising" },
      managerNotes: withNote(
        s.managerNotes,
        "feedback",
        `Manager: Feedback received. Updating ${feedback.affectedTasks.length} affected task(s) after approval.`,
      ),
    });

    await new Promise((r) => setTimeout(r, 600));

    const revisedTasks = tasksMarked.map((t) =>
      feedback.affectedTasks.includes(t.id)
        ? { ...t, state: "completed" as const }
        : t,
    );
    const revisedOutputs = s.outputs.map((o) => {
      if (!feedback.affectedTasks.includes(o.taskId)) return o;
      return {
        ...o,
        summary: `${o.summary} Revised per feedback: "${text.trim()}".`,
        confidence: Math.min(0.95, o.confidence + 0.05),
        nextSteps: ["Re-check with Review Agent", "Await final approval"],
        approved: "pending" as const,
      };
    });
    const { reviews, conflictSummary } = reviewOutputs(
      revisedOutputs,
      revisedTasks,
    );
    const feedbackItems = [
      { ...feedback, revisionStatus: "applied" as const },
      ...s.feedbackItems,
    ];

    setState((prev) => ({
      ...prev,
      tasks: revisedTasks,
      outputs: revisedOutputs,
      reviews,
      conflictSummary,
      feedbackItems,
      project: { ...prev.project, status: "complete" },
      currentStep: "final",
      metrics: computeMetrics({
        requirements: prev.requirements,
        tasks: revisedTasks,
        outputs: revisedOutputs,
        reviews,
        feedbackItems,
        startedAt: prev.startedAt,
        usefulnessScore: prev.metrics.usefulnessScore,
      }),
      managerNotes: withNote(
        prev.managerNotes,
        "final",
        `Manager: Applied revision to ${feedback.affectedTasks.length} task(s). Final project plan ready.`,
      ),
    }));
    setBusy(false);
    setBusyLabel("");
  }, []);

  const skipFeedback = useCallback(() => {
    setState((s) => ({
      ...s,
      project: { ...s.project, status: "complete" },
      currentStep: "final",
      managerNotes: withNote(
        s.managerNotes,
        "final",
        "Manager: No revisions requested. Packaging final project plan.",
      ),
      metrics: computeMetrics({
        requirements: s.requirements,
        tasks: s.tasks,
        outputs: s.outputs,
        reviews: s.reviews,
        feedbackItems: s.feedbackItems,
        startedAt: s.startedAt,
        usefulnessScore: s.metrics.usefulnessScore,
      }),
    }));
  }, []);

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
  }, []);

  const ackSensitiveUpload = useCallback(() => {
    setState((s) => ({ ...s, sensitiveUploadAck: true }));
  }, []);

  const reset = useCallback(() => setState(initialState()), []);

  const goTo = useCallback((step: WorkflowStep) => {
    setState((s) => ({ ...s, currentStep: step }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      ...state,
      busy,
      busyLabel,
      startProject,
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
      state,
      busy,
      busyLabel,
      startProject,
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
