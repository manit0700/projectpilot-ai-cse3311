"use client";
import { useEffect, useRef, useState } from "react";
import { validFiles, type SiteFiles } from "@/lib/studio";
import { sseData } from "@/lib/studio-stream";
import { delay, demoBannerText, demoBannerTitle, demoLabel, demoResult, demoStageMs, type StageResult, type StudioStage } from "@/lib/studio-demo";
import { initialActivity, type Activity } from "./studio-agents";

export type RunKind = "plan" | "build" | "revise" | "review";
export type GithubAction = "connect" | "import" | "publish";
export type GithubState = "unknown" | "unavailable" | "connected";
type Deps = {
  /** Live means access, a configured key and this tab's consent; otherwise prepared demo output is replayed. */
  live: boolean;
  /** Provider the server reports for Studio; only used for labels. */
  provider: "gemini" | "openrouter";
  /** Imported project name, used only as an honest label on demo output. */
  projectName?: string;
  onUnauthorized: () => void;
  brief: string;
  design: string;
  setDesign: (design: string) => void;
  sourcePlan: string | null;
  files: SiteFiles;
  rounds: number;
  feedback: string;
  setFeedback: (feedback: string) => void;
  say: (role: string, text: string, model?: string) => void;
  checkpoint: (files: SiteFiles, name: string) => void;
  snapshot: (name: string) => void;
};
type ApiResult = StageResult & { error?: string };

const busyLabels: Record<RunKind, string> = {
  plan: "Manager is designing…", build: "Developer is building…",
  revise: "Developer is building…", review: "Reviewer is inspecting the source…",
};
function workingTask(stage: StudioStage, note: string) {
  if (stage === "plan") return "Preparing the website design from your confirmed idea.";
  if (stage === "review") return "Checking the generated source against the approved design.";
  return note ? "Rewriting the website using your feedback and reviewer findings."
    : "Writing the HTML, CSS, and JavaScript from the approved design.";
}
const completedTask: Record<StudioStage, string> = {
  plan: "Design ready for your approval.", build: "Website files sent to the reviewer.",
  review: "Source review delivered. Browser testing still needed.",
};
export function useStudioRun(d: Deps) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState<Activity>(initialActivity);
  const [liveText, setLiveText] = useState("");
  const [liveModel, setLiveModel] = useState("");
  const [githubState, setGithubState] = useState<GithubState>("unknown");
  const [repository, setRepository] = useState("");
  const [prUrl, setPrUrl] = useState("");
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const setStage = (stage: StudioStage, status: string, task: string) =>
    setActivity((a) => ({ ...a, [stage]: { status, task } }));

  async function liveCall(stage: StudioStage, site: SiteFiles, approved: string, note: string, signal: AbortSignal) {
    const response = await fetch("/api/studio", {
      method: "POST", signal, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, brief: d.brief, plan: approved, files: site, feedback: note, live: true }),
    });
    let result: ApiResult | undefined;
    if (response.headers.get("content-type")?.includes("text/event-stream") && response.body) {
      let output = "";
      for await (const data of sseData(response.body)) {
        const event = JSON.parse(data);
        if (event.model) setLiveModel(event.model);
        if (event.type === "delta") { output += event.text; setLiveText(output); }
        if (event.type === "error") throw new Error(event.error);
        if (event.type === "result") result = event.result;
      }
      if (!result) throw new Error("The live response ended before the agent finished. Retry this step.");
    } else result = (await response.json()) as ApiResult;
    if (!response.ok) {
      if (response.status === 401) d.onUnauthorized();
      throw new Error(result?.error || "Agent request failed.");
    }
    return result;
  }

  async function call(stage: StudioStage, site: SiteFiles, approved: string, note: string, signal: AbortSignal) {
    setLiveText("");
    let result: StageResult;
    if (d.live) {
      setLiveModel(d.provider === "gemini" ? "Selecting a Gemini model…" : "Selecting a free OpenRouter model…");
      setStage(stage, "Working live", workingTask(stage, note));
      result = await liveCall(stage, site, approved, note, signal);
    } else {
      setLiveModel(demoLabel);
      setStage(stage, "Working · demo", workingTask(stage, note));
      await delay(demoStageMs, signal);
      result = demoResult(stage, d.projectName);
      setLiveText(result.files ? JSON.stringify(result.files, null, 2) : result.text || "");
    }
    setStage(stage, "Completed", completedTask[stage]);
    return result;
  }

  async function buildCycle(kind: "build" | "revise", signal: AbortSignal) {
    d.snapshot("Before agent changes");
    const note = kind === "revise" ? d.feedback : "";
    if (note) d.say("You → Team", note);
    let site = d.files;
    let review = note;
    // Demo replays one prepared build and one prepared review; review rounds apply to live runs.
    const rounds = d.live ? d.rounds : 0;
    for (let i = 0; i <= rounds; i++) {
      setBusy(i ? `Developer is addressing review ${i}…` : "Developer is building…");
      const built = await call("build", site, d.design, review, signal);
      if (!validFiles(built.files)) throw new Error("Agent returned invalid files.");
      site = built.files;
      d.checkpoint(site, i ? `Revision ${i}` : "First build");
      d.say("Developer → Reviewer", i
        ? "Updated the website using the review findings. Source is ready for another review."
        : "Created the website files. Please inspect the implementation against the approved design.", built.model);
      setBusy("Reviewer is inspecting the source…");
      const checked = await call("review", site, d.design, note, signal);
      review = checked.text || "";
      d.say("Reviewer → Developer", review, checked.model);
    }
    d.say("Manager → You", "The bounded build and source-review cycle is complete. Preview the site, test its " +
      "interactions, and edit the files or request another revision. The agents have not executed browser tests.");
    d.setFeedback("");
  }

  function failStages(aborted: boolean) {
    setActivity((a) => Object.fromEntries(Object.entries(a).map(([key, value]) => [key,
      value.status.startsWith("Working") ? { ...value, status: aborted ? "Stopped" : "Needs retry" } : value,
    ])) as Activity);
  }

  async function run(kind: RunKind) {
    if (!d.sourcePlan) { setError("Confirm your idea in the original planning workflow first."); return; }
    const controller = new AbortController();
    abort.current = controller;
    setBusy(busyLabels[kind]); setError("");
    try {
      if (!d.live && kind !== "review") d.say("Studio", `${demoBannerTitle}. ${demoBannerText(d.projectName)}`, demoLabel);
      if (kind === "review") {
        const result = await call("review", d.files, d.design, d.feedback, controller.signal);
        d.say("Reviewer → You", result.text || "", result.model);
      } else if (kind === "plan") {
        const result = await call("plan", d.files, d.sourcePlan, "", controller.signal);
        d.setDesign(result.text || "");
        d.say("Manager → Developer", result.text || "", result.model);
      } else await buildCycle(kind, controller.signal);
    } catch (e) {
      failStages(controller.signal.aborted);
      setError(controller.signal.aborted ? "Stopped. Completed files and messages are preserved."
        : e instanceof Error ? e.message : "Request failed.");
    } finally { setBusy(""); abort.current = null; }
  }

  async function githubAction(action: GithubAction) {
    const controller = new AbortController();
    abort.current = controller;
    setBusy("Connecting to GitHub MCP…"); setError(""); setPrUrl("");
    try {
      const response = await fetch("/api/studio/github", {
        method: "POST", signal: controller.signal, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "publish" ? { files: d.files, confirm: true } : {}) }),
      });
      const result = await response.json();
      // 503 means the server has no GitHub MCP token or repository; publishing is deferred in this deployment.
      if (response.status === 503) { setGithubState("unavailable"); setRepository(""); return; }
      if (!response.ok) {
        if (response.status === 401) d.onUnauthorized();
        throw new Error(result.error || "GitHub request failed.");
      }
      setGithubState("connected"); setRepository(result.repository);
      if (action === "import") {
        if (!validFiles(result.files)) throw new Error("Invalid imported website.");
        d.snapshot("Before GitHub import");
        d.checkpoint(result.files, "Imported from GitHub");
        d.say("GitHub MCP → Team", `Imported projectpilot-site/index.html from ${result.repository}. ` +
          "This source is now available to the developer for revision.");
      }
      if (action === "publish") {
        setPrUrl(result.url);
        d.say("GitHub MCP → You", `Created a draft pull request in ${result.repository} on branch ${result.branch}. ` +
          "Review it on GitHub before merging.");
      }
    } catch (e) {
      setError(controller.signal.aborted
        ? "Stopped waiting for GitHub. Check the repository for partially completed operations before retrying."
        : e instanceof Error ? e.message : "GitHub request failed.");
    } finally { setBusy(""); abort.current = null; }
  }

  return {
    busy, error, setError, activity, liveText, liveModel, run, githubAction,
    github: { state: githubState, repository, prUrl },
    stop: () => abort.current?.abort(),
  };
}
