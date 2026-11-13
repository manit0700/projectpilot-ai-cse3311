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
import { DEMO_IDEA, DEMO_TARGET_USER, draftDemoAnswers, prefillDemoAnswers } from "./demo-fixtures";
import { enoughDetail } from "./input-rules";
import {
  answersDraftedNote, planNotes, questionsAskedNote, requirementsDraftedNote, withNote, withNotes,
} from "./manager-log";
import { computeMetrics, normalizeUsefulness } from "./metrics";
import { createProject, DEMO_STEP_MS, demoPause, generateQuestions, generateRequirements, generateTasks } from "./mock-ai";
import { addUsage, logAnswerEdit, logEvents, logModelEvents, type ModelMeta } from "./session-events";
import { errorKind, failureLabel, postModel } from "./specialist-client";
import {
  addRequirementState, addTaskState, deleteRequirementState, editIdeaState, editOutputSummaryState, type NewTask,
} from "./store-actions";
import { keepRecoveryCopy, parseImport, restoreSavedState, serializeState, STORAGE_KEY, type ManagerMode } from "./store-persistence";
import {
  approveOutputState, approveOutputsState, editRequirementState, editTaskState, openRevisionState,
  requestRevisionState, reviseDemoOutputsState, selectRevisionTasksState, skipFeedbackState, toggleRequirementState,
} from "./store-reducers";
import { initialState } from "./store-initial";
import { runTasks, stoppedRunState, timing } from "./store-run";
import type { Priority, WorkflowStep } from "./types";
import { buildApprovedSummary, canVisit, requirementsReady, topologicalOrder, validateTasks, type TaskEdit, type WorkflowState } from "./workflow";

type Store = WorkflowState & {
  managerMode: ManagerMode;
  setManagerMode: (mode: ManagerMode) => void;
  savedStatus: string;
  hydrated: boolean;
  busy: boolean;
  editRequirement: (id: string, text: string) => void;
  /** Each editing action returns a user-facing error, or null on success. */
  addRequirement: (text: string, priority?: Priority) => string | null;
  deleteRequirement: (id: string) => void;
  addTask: (task: NewTask) => string | null;
  editIdea: (idea: string, targetUser: string) => string | null;
  editOutputSummary: (outputId: string, text: string) => string | null;
  editTask: (id: string, edit: TaskEdit) => string | null;
  /** Aborts the in-flight model request; the current task returns to the queue. */
  stopRun: () => void;
  /** Epoch ms when a rate-limit pause ends and the run resumes by itself; null when not paused. Stop cancels it. */
  pausedUntil: number | null;
  /** Provider cooldown info from GET /api/manager, fetched once after a quota stop; null until then. */
  providerCooldowns: unknown;
  importProject: (json: string) => { ok: true } | { ok: false; error: string };
  /** Snapshot of the current project for exports; always the latest state, even between renders. */
  exportState: () => WorkflowState;
  approveOutput: (id: string) => void;
  requestRevision: (id: string) => void;
  selectRevisionTasks: (ids: string[]) => void;
  retryTask: (id: string) => Promise<void>;
  skipTask: (id: string) => void;
  canNavigate: (step: WorkflowStep) => boolean;
  busyLabel: string;
  startProject: (idea: string, targetUser: string, options?: { rubric?: string; constitution?: string }) => void;
  startDemoProject: () => void;
  updateAnswer: (questionId: string, answer: string) => void;
  suggestAnswers: () => void;
  submitAnswers: () => void;
  toggleRequirement: (id: string, status: "approved" | "rejected") => void;
  approveRequirements: () => void;
  approveTaskPlan: () => Promise<void>;
  approveOutputs: () => void;
  submitFeedback: (text: string) => Promise<void>;
  skipFeedback: () => void;
  setUsefulness: (score: number) => void;
  reset: () => void;
  goTo: (step: WorkflowStep) => void;
};

const ProjectStoreContext = createContext<Store | null>(null);

const MANAGER_HALT = {
  quota: "Provider quota is used up. Your input is saved; retry when quota resets or switch provider.",
  auth: "The provider rejected the API key or access. Your input is saved; fix the key or switch provider, then retry.",
};

export function ProjectStoreProvider({ children }: { children: ReactNode }) {
  const [state, renderState] = useState<WorkflowState>(initialState);
  const [busy, setBusy] = useState(false);
  const [busyLabel, setBusyLabel] = useState("");
  const [managerMode, changeManagerMode] = useState<ManagerMode>("demo");
  const [savedStatus, setSavedStatus] = useState("Loading saved progress…");
  const [hydrated, setHydrated] = useState(false);
  const [pausedUntil, setPausedUntil] = useState<number | null>(null);
  const [providerCooldowns, setProviderCooldowns] = useState<unknown>(null);
  const modeRef = useRef<ManagerMode>("demo");
  const stateRef = useRef(state);
  const busyRef = useRef(false);
  // Stop: one controller per busy period; its signal reaches every model request and demo pause.
  const abortRef = useRef<AbortController | null>(null);
  const stoppedRef = useRef(false);
  const isLive = () => modeRef.current === "live";
  // Update the snapshot in event handlers, never during render. Async actions and
  // rapid clicks now share the same guarded state as the rendered UI.
  const setState = useCallback((change: WorkflowState | ((s: WorkflowState) => WorkflowState)) => {
    const next = typeof change === "function" ? change(stateRef.current) : change;
    stateRef.current = next;
    renderState(next);
  }, []);
  // Reducers run only when no async action holds the store.
  const dispatch = useCallback((reduce: (s: WorkflowState) => WorkflowState) => {
    if (!busyRef.current) setState(reduce);
  }, [setState]);
  const beginBusy = useCallback((label: string) => {
    busyRef.current = true; stoppedRef.current = false; abortRef.current = new AbortController();
    setBusy(true); setBusyLabel(label);
  }, []);
  const endBusy = useCallback(() => { busyRef.current = false; abortRef.current = null; setBusy(false); setBusyLabel(""); }, []);

  // Defer browser storage hydration until after the first client render.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
          const restored = restoreSavedState(raw, initialState());
          setState(restored.state);
          modeRef.current = restored.mode;
          changeManagerMode(restored.mode);
        }
        setSavedStatus("Progress saved on this browser");
      } catch {
        keepRecoveryCopy();
        setSavedStatus("Saved progress could not be loaded. A recovery copy was kept when storage was available. Start a new project or download recovery data.");
      }
      setHydrated(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [setState]);

  useEffect(() => {
    if (!hydrated) return;
    let message = "Progress saved on this browser";
    try {
      localStorage.setItem(STORAGE_KEY, serializeState(state, managerMode));
    } catch {
      message = "Saving unavailable. Keep this tab open and export your completed plan.";
    }
    const timer = window.setTimeout(() => setSavedStatus(message), 0);
    return () => window.clearTimeout(timer);
  }, [state, managerMode, hydrated]);

  const setManagerMode = useCallback((mode: ManagerMode) => {
    if (busyRef.current || stateRef.current.project.id) return;
    modeRef.current = mode;
    changeManagerMode(mode);
  }, []);

  const managerRequest = useCallback(async <T,>(stage: string, context: unknown): Promise<{ items: T; meta?: ModelMeta }> => {
    beginBusy(`Manager: generating ${stage}…`);
    try {
      const { result, meta } = await postModel("/api/manager", { stage, context }, 65000, abortRef.current?.signal, "Manager request failed. Try again.");
      return { items: result.items as T, meta };
    } finally {
      endBusy();
    }
  }, [beginBusy, endBusy]);

  // One lookup after a quota stop, so the UI can show which providers are cooling down. Failure is harmless.
  const loadCooldowns = useCallback(() => {
    void fetch("/api/manager", { method: "GET" }).then((r) => r.json()).then((body: { cooldowns?: unknown }) => setProviderCooldowns(body?.cooldowns ?? null)).catch(() => undefined);
  }, []);

  const stopRun = useCallback(() => {
    if (!busyRef.current) return;
    stoppedRef.current = true;
    abortRef.current?.abort();
  }, []);

  const reportManagerError = useCallback((error: unknown) => {
    setState((s) => {
      if (stoppedRef.current) return logEvents({ ...s, workflowNotice: "Stopped. Your input is preserved; use the same button to retry." }, true, { type: "run_stopped", detail: "manager request" });
      const kind = errorKind(error);
      const notice = kind === "quota" || kind === "auth" ? MANAGER_HALT[kind]
        : error instanceof Error ? `${error.message} Your input is preserved. Use the same button to retry.` : "Manager unavailable. Your input is preserved; retry when ready.";
      if (kind === "quota") loadCooldowns();
      return logEvents({ ...s, workflowNotice: notice }, true, { type: "run_failed", detail: `${failureLabel(error)}: ${error instanceof Error ? error.message : "Manager unavailable"}` });
    });
  }, [setState, loadCooldowns]);

  // Merges drafted answers into the current questions by position. Only blank or
  // still-unedited drafts are replaced, so anything the user typed is kept.
  const applyDrafts = useCallback((drafts: Array<{ answer: string }>, source: string, live: boolean, meta?: ModelMeta) => {
    setState((s) => {
      if (s.requirements.length || drafts.length !== s.questions.length) return s;
      const replaced = s.questions.filter((q) => !(q.answer.trim() && !q.suggested));
      const questions = s.questions.map((q, i) => (q.answer.trim() && !q.suggested ? q : { ...q, answer: drafts[i].answer, suggested: true }));
      return logModelEvents({ ...s, questions, workflowNotice: null, managerNotes: withNote(s.managerNotes, "questions", answersDraftedNote(questions.filter((q) => q.suggested).length, source)) },
        live, replaced.map((q) => ({ type: "answer_drafted" as const, entityId: q.id, detail: live ? "live" : "demo", after: questions.find((x) => x.id === q.id)?.answer })), meta);
    });
  }, [setState]);

  const draftLiveAnswers = useCallback((auto: boolean) => {
    const snapshot = stateRef.current;
    const questions = snapshot.questions.map(({ id, prompt, why }) => ({ id, prompt, why }));
    void managerRequest<Array<{ answer: string }>>("answers", { project: snapshot.project, questions })
      .then(({ items, meta }) => applyDrafts(items, "live manager", true, meta))
      .catch((error: unknown) => {
        if (!auto || stoppedRef.current) return reportManagerError(error);
        // Automatic drafting must never block the flow: the questions stay and the user can type or press Suggest answers.
        setState((s) => logEvents({ ...s, managerNotes: withNote(s.managerNotes, "questions", "Could not draft answers automatically; write your own or press Suggest answers to retry") }, true, { type: "run_failed", detail: `${errorKind(error) ?? "error"}: automatic answer drafting` }));
      });
  }, [managerRequest, applyDrafts, reportManagerError, setState]);

  const startProject = useCallback((idea: string, targetUser: string, options?: { rubric?: string; constitution?: string }) => {
    if (busyRef.current || stateRef.current.project.id || !enoughDetail(idea) || targetUser.trim().length < 3) return;
    const project = createProject(idea, targetUser, options);
    const live = isLive();
    const begin = (questions: WorkflowState["questions"], source: string, extra: string[] = [], meta?: ModelMeta): WorkflowState => logModelEvents({
      ...initialState(), project, questions, currentStep: "questions", startedAt: Date.now(),
      managerNotes: withNotes([], "questions", [`Idea received for "${project.title}"; ${source}`, questionsAskedNote(questions), ...extra]),
    }, live, [{ type: "project_started", entityId: project.id, detail: `${project.targetUser}${project.rubric ? "; rubric" : ""}${project.constitution ? "; constitution" : ""}`, after: project.description }], meta);
    if (live) {
      setState((s) => ({ ...s, draftBrief: { idea, targetUser } }));
      void managerRequest<WorkflowState["questions"]>("questions", { project })
        .then(({ items, meta }) => { setState(begin(items, "live manager drafted clarifying questions", [], meta)); draftLiveAnswers(true); })
        .catch(reportManagerError);
      return;
    }
    const drafted = draftDemoAnswers(project, generateQuestions(idea));
    setState(logEvents(begin(drafted, "clarifying scope before drafting requirements", [answersDraftedNote(drafted.length, "prepared demo drafts")]), false,
      drafted.map((q) => ({ type: "answer_drafted" as const, entityId: q.id, detail: "demo", after: q.answer }))));
  }, [setState, managerRequest, reportManagerError, draftLiveAnswers]);

  const suggestAnswers = useCallback(() => {
    const s = stateRef.current;
    if (busyRef.current || !s.project.id || !s.questions.length || s.requirements.length) return;
    if (isLive()) { draftLiveAnswers(false); return; }
    applyDrafts(draftDemoAnswers(s.project, s.questions), "prepared demo drafts", false);
  }, [draftLiveAnswers, applyDrafts]);

  // Guided demo: stops on Clarify with sample answers filled in, so one press
  // generates requirements and every later manager decision is visible.
  const startDemoProject = useCallback(() => {
    if (busyRef.current || stateRef.current.project.id) return;
    modeRef.current = "demo";
    changeManagerMode("demo");
    const project = createProject(DEMO_IDEA, DEMO_TARGET_USER);
    const questions = prefillDemoAnswers(generateQuestions(DEMO_IDEA));
    setState(logEvents({
      ...initialState(), project, questions, currentStep: "questions", startedAt: Date.now(),
      managerNotes: withNotes([], "questions", [
        `Guided demo loaded: "${project.title}"`, questionsAskedNote(questions),
        "Sample answers are pre-filled; edit any of them, then generate requirements",
      ]),
    }, false, [{ type: "project_started", entityId: project.id, detail: "guided demo", after: project.description },
      ...questions.map((q) => ({ type: "answer_drafted" as const, entityId: q.id, detail: "demo", after: q.answer }))]));
  }, [setState]);

  const updateAnswer = useCallback((questionId: string, answer: string) => {
    if (stateRef.current.requirements.length) return;
    dispatch((s) => {
      const question = s.questions.find((q) => q.id === questionId);
      if (!question) return s;
      return logAnswerEdit({ ...s, questions: s.questions.map((q) => (q.id === questionId ? { ...q, answer, suggested: false } : q)) }, isLive(), questionId, question.answer, answer);
    });
  }, [dispatch]);

  const submitAnswers = useCallback(() => {
    if (busyRef.current || !stateRef.current.project.id || !stateRef.current.questions.length) return;
    if (stateRef.current.requirements.length) {
      setState((s) => ({ ...s, currentStep: "requirements" }));
      return;
    }
    const drafted = (s: WorkflowState, requirements: WorkflowState["requirements"], live: boolean, meta?: ModelMeta): WorkflowState => logModelEvents({
      ...s, requirements, currentStep: "requirements", workflowNotice: null,
      project: { ...s.project, status: "requirements_pending" },
      managerNotes: withNotes(s.managerNotes, "requirements", [requirementsDraftedNote(requirements), "Approve, reject or edit each requirement; tasks are planned only from approved ones"]),
    }, live, requirements.map((r) => ({ type: "requirement_drafted" as const, entityId: r.id, detail: live ? "live" : "demo", after: r.text })), meta);
    if (isLive() && stateRef.current.questions.every((q) => enoughDetail(q.answer))) {
      const snapshot = stateRef.current;
      void managerRequest<WorkflowState["requirements"]>("requirements", { project: snapshot.project, questions: snapshot.questions })
        .then(({ items, meta }) => setState((s) => drafted(s, items, true, meta))).catch(reportManagerError);
      return;
    }
    setState((s) => {
      const unanswered = s.questions.filter((q) => !enoughDetail(q.answer));
      if (unanswered.length > 0) {
        return { ...s, managerNotes: withNote(s.managerNotes, "questions", `${unanswered.length} answer(s) still missing; requirements wait until every question has 12+ characters`) };
      }
      return drafted(s, generateRequirements(s.project, s.questions), false);
    });
  }, [setState, managerRequest, reportManagerError]);

  const editRequirement = useCallback((id: string, text: string) => {
    if (enoughDetail(text)) dispatch((s) => editRequirementState(s, id, text, isLive()));
  }, [dispatch]);

  const toggleRequirement = useCallback((id: string, status: "approved" | "rejected") => {
    dispatch((s) => toggleRequirementState(s, id, status, isLive()));
  }, [dispatch]);

  // Runs a manual-edit reducer when the store is idle; returns its error or null.
  const manualEdit = useCallback((reduce: (s: WorkflowState, live: boolean) => { error: string } | { state: WorkflowState | null }): string | null => {
    if (busyRef.current) return "Wait for the current run to finish, or press Stop, before editing.";
    const result = reduce(stateRef.current, isLive());
    if ("error" in result) return result.error;
    if (result.state) setState(result.state);
    return null;
  }, [setState]);

  const addRequirement = useCallback((text: string, priority: Priority = "should") => manualEdit((s, live) => addRequirementState(s, text, priority, live)), [manualEdit]);
  const deleteRequirement = useCallback((id: string) => { manualEdit((s, live) => deleteRequirementState(s, id, live)); }, [manualEdit]);
  const addTask = useCallback((task: NewTask) => manualEdit((s, live) => addTaskState(s, task, live)), [manualEdit]);
  const editIdea = useCallback((idea: string, targetUser: string) => manualEdit((s, live) => editIdeaState(s, idea, targetUser, live)), [manualEdit]);
  const editOutputSummary = useCallback((outputId: string, text: string) => manualEdit((s, live) => editOutputSummaryState(s, outputId, text, live)), [manualEdit]);

  const approveRequirements = useCallback(() => {
    if (busyRef.current) return;
    const snapshot = stateRef.current;
    const planned = (s: WorkflowState, tasks: WorkflowState["tasks"], fresh: boolean, meta?: ModelMeta): WorkflowState => ({
      ...s, tasks, currentStep: "tasks", workflowNotice: null, usage: addUsage(s.usage, meta),
      project: { ...s.project, status: s.project.status === "requirements_pending" ? "tasks_pending" : s.project.status,
        approvedSummary: buildApprovedSummary(s.project, s.requirements, tasks) },
      managerNotes: fresh ? withNotes(s.managerNotes, "tasks", planNotes(tasks, s.requirements)) : s.managerNotes,
    });
    if (isLive() && requirementsReady(snapshot) && !snapshot.tasks.length) {
      void managerRequest<WorkflowState["tasks"]>("tasks", { project: snapshot.project, requirements: snapshot.requirements }).then(({ items: tasks, meta }) => {
        const error = validateTasks(tasks);
        if (error || !tasks.length) throw new Error(error || "Manager returned an empty plan.");
        setState((s) => planned(s, topologicalOrder(tasks), true, meta));
      }).catch(reportManagerError);
      return;
    }
    setState((s) => {
      if (!requirementsReady(s)) return s;
      // Revisit without replacing IDs, edits, existing outputs, or approvals.
      if (s.tasks.length) {
        return { ...planned(s, s.tasks, false), workflowNotice: s.staleTaskIds.length ? "Review the updated requirements against this task plan. Existing tasks are preserved; approval will refresh affected outputs." : null };
      }
      return planned(s, topologicalOrder(generateTasks(s.project, s.requirements)), true);
    });
  }, [setState, managerRequest, reportManagerError]);

  const editTask = useCallback((id: string, edit: TaskEdit): string | null => {
    if (busyRef.current) return "Task editing is available before plan approval.";
    const result = editTaskState(stateRef.current, id, edit, isLive());
    if ("error" in result) return result.error;
    if (result.state) setState(result.state);
    return null;
  }, [setState]);

  // Live workers receive completed prerequisite deliverables. Serial scheduling
  // bounds API usage and makes failures independent of unrelated completed work.
  // The run ends on the board; the user chooses when to open the review.
  const executeTasks = useCallback(async (onlyId?: string) => {
    const snapshot = stateRef.current;
    if (busyRef.current || !requirementsReady(snapshot) || !snapshot.tasks.length || validateTasks(snapshot.tasks)) return;
    if (onlyId) {
      const task = snapshot.tasks.find((t) => t.id === onlyId);
      if (!snapshot.planApproved || task?.state !== "failed" || task.dependencies.some((id) => snapshot.tasks.find((t) => t.id === id)?.state !== "completed")) return;
    } else if (snapshot.project.status === "requirements_pending") return;
    beginBusy("Running assigned agents…");
    const signal = abortRef.current!.signal;
    const pending = snapshot.tasks.filter((t) => t.state !== "completed").length;
    setState((s) => {
      const approving = !s.planApproved;
      const started: WorkflowState = { ...s, planApproved: true, currentStep: "board",
        project: { ...s.project, status: "agents_running" }, workflowNotice: null,
        skippedTaskIds: onlyId ? s.skippedTaskIds.filter((id) => id !== onlyId) : s.skippedTaskIds,
        managerNotes: withNote(s.managerNotes, "board", onlyId ? `Retrying ${s.tasks.find((t) => t.id === onlyId)?.title ?? "task"} on your request` : s.planApproved ? `Resuming ${pending} unfinished task(s) in dependency order` : `Plan approved; running ${pending} tasks in dependency order, one specialist at a time`),
      };
      return approving ? logEvents(started, isLive(), { type: "plan_approved", entityId: s.project.id, detail: `${s.tasks.length} tasks` }) : started;
    });
    const ctx = { stateRef, setState, setBusyLabel, live: isLive, signal, stopped: () => stoppedRef.current };
    try {
      let outcome = await runTasks(ctx, onlyId);
      if (outcome.pauseSeconds !== undefined) {
        // Per-minute limit: wait it out once, visibly and cancellably, then run the rest. A second limit stops the run.
        const ms = outcome.pauseSeconds * 1000;
        setPausedUntil(Date.now() + ms);
        setBusyLabel("Paused for the provider rate limit; resuming automatically…");
        try { await timing.sleep(ms, signal); }
        catch { setState((prev) => stoppedRunState(prev, isLive())); return; }
        setPausedUntil(null);
        setState((prev) => ({ ...prev, project: { ...prev.project, status: "agents_running" }, workflowNotice: null, managerNotes: withNote(prev.managerNotes, "board", "Rate-limit pause over; resuming the queued tasks once") }));
        outcome = await runTasks({ ...ctx, allowPause: false }, onlyId);
      }
      if (outcome.halted?.kind === "quota") loadCooldowns();
    } finally {
      setPausedUntil(null);
      endBusy();
    }
  }, [setState, beginBusy, endBusy, loadCooldowns]);

  const approveTaskPlan = useCallback(() => executeTasks(), [executeTasks]);
  const retryTask = useCallback((id: string) => executeTasks(id), [executeTasks]);
  const skipTask = useCallback((id: string) => {
    dispatch((s) => s.tasks.some((t) => t.id === id && t.state === "failed") ? {
      ...s, skippedTaskIds: [...new Set([...s.skippedTaskIds, id])],
      workflowNotice: "Task skipped for now, not completed. Dependents and the final plan remain blocked until it succeeds. You can retry it later.",
    } : s);
  }, [dispatch]);

  const approveOutput = useCallback((id: string) => dispatch((s) => approveOutputState(s, id, isLive())), [dispatch]);
  const requestRevision = useCallback((id: string) => dispatch((s) => requestRevisionState(s, id, isLive())), [dispatch]);
  const selectRevisionTasks = useCallback((ids: string[]) => dispatch((s) => selectRevisionTasksState(s, ids)), [dispatch]);
  const approveOutputs = useCallback(() => dispatch(approveOutputsState), [dispatch]);
  const skipFeedback = useCallback(() => dispatch((s) => skipFeedbackState(s, isLive())), [dispatch]);

  const submitFeedback = useCallback(async (text: string) => {
    const s = stateRef.current;
    const selected = s.revisionTaskIds.filter((id) => s.outputs.some((o) => o.taskId === id) && s.tasks.find((t) => t.id === id)?.state === "completed");
    if (busyRef.current || !enoughDetail(text) || !selected.length || !s.planApproved || s.staleTaskIds.length) return;
    const live = isLive();
    const opened = openRevisionState(s, selected, text, live);
    setState(opened.state);
    if (live) {
      await executeTasks();
      return;
    }
    beginBusy("Revising selected outputs…");
    try {
      await demoPause(DEMO_STEP_MS, abortRef.current?.signal);
      setState((prev) => reviseDemoOutputsState(prev, selected, text, opened.feedbackId));
    } catch (error) {
      if (!stoppedRef.current) throw error;
      // Stopped before the revision landed: restore the pre-feedback state so nothing is half applied.
      setState(logEvents({ ...s, workflowNotice: "Revision stopped. Nothing was changed; request the revision again when ready." }, false, { type: "run_stopped", detail: "revision" }));
    } finally {
      endBusy();
    }
  }, [setState, executeTasks, beginBusy, endBusy]);

  const setUsefulness = useCallback((score: number) => {
    setState((s) => {
      const rating = normalizeUsefulness(score);
      const next = { ...s, metrics: { ...s.metrics, usefulnessScore: rating } };
      return rating === null || !s.project.id ? next : logEvents(next, isLive(), { type: "usage_rated", entityId: s.project.id, detail: `${rating}/10` });
    });
  }, [setState]);

  const importProject = useCallback((json: string): { ok: true } | { ok: false; error: string } => {
    const current = stateRef.current;
    if (busyRef.current || current.tasks.some((t) => t.state === "in_progress")) return { ok: false, error: "A run is in progress. Wait for it to finish or press Stop, then import." };
    let imported: ReturnType<typeof parseImport>;
    try { imported = parseImport(json, initialState()); }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : "That file could not be imported." }; }
    // The project being replaced is kept so a wrong import can be undone from the recovery copy.
    if (current.project.id) keepRecoveryCopy(serializeState(current, modeRef.current));
    setState(imported.state);
    if (imported.mode) { modeRef.current = imported.mode; changeManagerMode(imported.mode); }
    return { ok: true };
  }, [setState]);

  const exportState = useCallback(() => stateRef.current, []);
  const reset = useCallback(() => dispatch(initialState), [dispatch]);

  const goTo = useCallback((step: WorkflowStep) => {
    dispatch((s) => canVisit(s, step) ? { ...s, currentStep: step } : s);
  }, [dispatch]);

  const value = useMemo<Store>(
    () => ({
      ...state,
      managerMode, setManagerMode, savedStatus, hydrated,
      metrics: computeMetrics({ ...state, usefulnessScore: state.metrics.usefulnessScore }),
      canNavigate: (step) => !busy && canVisit(state, step),
      editRequirement, addRequirement, deleteRequirement, addTask, editIdea, editOutputSummary, stopRun, pausedUntil, providerCooldowns, importProject, exportState,
      editTask, approveOutput, requestRevision, selectRevisionTasks, retryTask, skipTask,
      busy, busyLabel, startProject, startDemoProject, updateAnswer, suggestAnswers, submitAnswers, toggleRequirement,
      approveRequirements, approveTaskPlan, approveOutputs, submitFeedback, skipFeedback, setUsefulness,
      reset, goTo,
    }),
    [
      state, managerMode, setManagerMode, savedStatus, hydrated,
      editRequirement, addRequirement, deleteRequirement, addTask, editIdea, editOutputSummary, stopRun, pausedUntil, providerCooldowns, importProject, exportState,
      editTask, approveOutput, requestRevision, selectRevisionTasks, retryTask, skipTask,
      busy, busyLabel, startProject, startDemoProject, updateAnswer, suggestAnswers, submitAnswers, toggleRequirement,
      approveRequirements, approveTaskPlan, approveOutputs, submitFeedback, skipFeedback, setUsefulness,
      reset, goTo,
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
