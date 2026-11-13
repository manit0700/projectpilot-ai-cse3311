"use client";
import { starter, validFiles, type SiteFiles, type StudioMessage } from "@/lib/studio";
import { validHandoff, type StudioHandoff } from "@/lib/studio-handoff";

export const storageKey = "projectpilot-website-studio-v1";
export const recoveryKey = "projectpilot-website-studio-recovery";
export const saveVersion = 2;

export type Version = { name: string; files: SiteFiles };
export type Workspace = {
  brief: string;
  design: string;
  files: SiteFiles;
  messages: StudioMessage[];
  versions: Version[];
  sourcePlan: StudioHandoff | null;
};
export const defaultBrief =
  "Build a portfolio website for a student software developer with projects, skills, and a contact section.";
export const emptyWorkspace: Workspace = {
  brief: defaultBrief, design: "", files: starter, messages: [], versions: [], sourcePlan: null,
};

export type Restore =
  | { status: "empty" }
  | { status: "restored"; workspace: Workspace }
  // The saved payload could not be parsed or validated; a recovery copy was kept when possible.
  | { status: "failed" };

function validMessages(value: unknown): value is StudioMessage[] {
  return Array.isArray(value) && value.every((m) => typeof m?.role === "string" && typeof m?.text === "string");
}
function validVersions(value: unknown): value is Version[] {
  return Array.isArray(value) && value.every((v) => typeof v?.name === "string" && validFiles(v.files));
}
function parseWorkspace(raw: string): Workspace {
  const saved = JSON.parse(raw);
  if (!saved || typeof saved !== "object") throw new Error("Invalid save");
  // Saves written before `version` existed stored the website design under `plan`.
  const version = saved.version ?? 1;
  if (version !== 1 && version !== saveVersion) throw new Error("Unknown save version");
  const design = version === 1 ? saved.plan : saved.design;
  if (!validFiles(saved.files) || typeof saved.brief !== "string" || typeof design !== "string" ||
      !validMessages(saved.messages) || !validVersions(saved.versions)) throw new Error("Invalid save");
  return {
    brief: saved.brief, design, files: saved.files, messages: saved.messages, versions: saved.versions,
    sourcePlan: validHandoff(saved.sourcePlan) ? saved.sourcePlan : null,
  };
}

export function restoreWorkspace(): Restore {
  let raw: string | null = null;
  try { raw = localStorage.getItem(storageKey); } catch { return { status: "empty" }; }
  if (!raw) return { status: "empty" };
  try {
    return { status: "restored", workspace: parseWorkspace(raw) };
  } catch {
    // Mirror the planning store: keep the damaged payload before anything can overwrite it.
    try { localStorage.setItem(recoveryKey, raw); } catch { /* Storage may be unavailable. */ }
    return { status: "failed" };
  }
}

export function persistWorkspace(workspace: Workspace): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ version: saveVersion, ...workspace }));
    return true;
  } catch { return false; }
}

export function readRecovery(): string | null {
  try { return localStorage.getItem(recoveryKey); } catch { return null; }
}

export function downloadText(name: string, text: string, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
