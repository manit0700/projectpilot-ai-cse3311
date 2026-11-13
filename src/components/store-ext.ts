"use client";

import { useProjectStore } from "@/lib/store";
import type { Priority } from "@/lib/types";
import type { TaskEdit } from "@/lib/workflow";

export interface RunUsage {
  requests?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalLatencyMs?: number;
  models?: string[];
}

/**
 * Store members that the core stream adds over time. Every member is optional here so the UI
 * feature-detects them (`typeof ext.addRequirement === "function"`) and hides the control
 * when the store does not provide it.
 */
export interface StoreExt {
  addRequirement?: (text: string, priority?: Priority) => string | null;
  deleteRequirement?: (id: string) => void;
  addTask?: (edit: TaskEdit & { expectedOutput?: string; constraints?: string }) => string | null;
  editIdea?: (idea: string, targetUser: string) => string | null;
  stopRun?: () => void;
  usage?: RunUsage | null;
  /** `cooldowns` from GET /api/manager after a quota stop; shape is validated in cooldownLine. */
  providerCooldowns?: unknown;
  startProject?: (idea: string, targetUser: string, options?: { rubric?: string; constitution?: string }) => void;
}

export function useStoreExt(): StoreExt {
  return useProjectStore() as unknown as StoreExt;
}

export function usageLine(usage: RunUsage | null | undefined): string | null {
  if (!usage) return null;
  const requests = usage.requests ?? 0;
  const tokens = (usage.promptTokens ?? 0) + (usage.completionTokens ?? 0);
  if (!requests && !tokens) return null;
  const parts = [`${requests} request${requests === 1 ? "" : "s"}`, `~${tokens.toLocaleString("en-US")} tokens`];
  if (usage.models?.length) parts.push(usage.models.join(", "));
  return `Run usage: ${parts.join(" · ")}`;
}

const PROVIDER_NAMES: Record<string, string> = { gemini: "Gemini", openrouter: "OpenRouter", openai: "OpenAI" };

function resumeIn(seconds: number): string {
  if (seconds < 90) return `${Math.max(1, Math.round(seconds))} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  return `${Math.round(seconds / 3600)} h`;
}

/** 'Gemini resumes in ~12 h · OpenRouter in ~5 h', soonest entry per provider; null when nothing is cooling. */
export function cooldownLine(raw: unknown): string | null {
  if (!Array.isArray(raw)) return null;
  const soonest = new Map<string, number>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const { provider, untilSeconds } = item as { provider?: unknown; untilSeconds?: unknown };
    if (typeof provider !== "string" || typeof untilSeconds !== "number" || !Number.isFinite(untilSeconds) || untilSeconds <= 0) continue;
    soonest.set(provider, Math.min(soonest.get(provider) ?? Infinity, untilSeconds));
  }
  if (!soonest.size) return null;
  const parts = [...soonest].map(([provider, seconds], index) => `${PROVIDER_NAMES[provider] ?? provider}${index === 0 ? " resumes" : ""} in ~${resumeIn(seconds)}`);
  return `Free-tier limit: ${parts.join(" · ")}`;
}
