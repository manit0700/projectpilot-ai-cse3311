"use client";
import { useEffect, useId, useState } from "react";

export type LiveProvider = "openai" | "openrouter" | "gemini";
export const toProvider = (value: unknown): LiveProvider => (value === "openrouter" || value === "gemini" ? value : "openai");
/** Session-scoped marker that the data-sharing notice was accepted in this browser tab. */
export const LIVE_CONSENT_KEY = "projectpilot-live-consent";

export function LiveAccess({ onUnlocked, provider = "auto", variant = "default" }: { onUnlocked: () => void; provider?: LiveProvider | "auto"; variant?: "default" | "purple" }) {
  const [detectedProvider, setDetectedProvider] = useState<LiveProvider>("openai");
  const activeProvider: LiveProvider = provider === "auto" ? detectedProvider : provider;
  useEffect(() => {
    if (provider !== "auto") return;
    let cancelled = false;
    fetch("/api/manager").then(r => r.json()).then(s => { if (!cancelled) setDetectedProvider(toProvider(s.provider)); }).catch(() => {});
    return () => { cancelled = true; };
  }, [provider]);
  const [codeRequired, setCodeRequired] = useState(true);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/live-access').then(r => r.json()).then(settings => {
      if (!cancelled) setCodeRequired(settings.enabled === true);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);
  const [code, setCode] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const helpId = useId();
  const providerName = activeProvider === "openrouter" ? "OpenRouter and its model providers" : activeProvider === "gemini" ? "Google (Gemini API)" : "OpenAI";
  const blocked = !consent || busy || (codeRequired && !code);
  const blockedReason = busy ? "Checking access…" : !consent ? "Accept the data-sharing notice to activate Live." : codeRequired && !code ? "Enter the live access code." : null;
  const purple = variant === "purple";
  return <form aria-label="Live API access" className={`max-w-2xl space-y-5 ${purple ? "pt-2 text-slate-700 dark:text-slate-200" : ""}`} onSubmit={async (event) => {
    event.preventDefault();
    if (!consent) { setError("Accept the data-sharing notice to use Live API."); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/live-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, consent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not unlock Live API.");
      try { sessionStorage.setItem(LIVE_CONSENT_KEY, "1"); } catch { /* Storage may be unavailable; the unlock still applies to this view. */ }
      setCode(""); onUnlocked();
    } catch (error) { setError(error instanceof Error ? error.message : "Access request failed. Try again."); }
    finally { setBusy(false); }
  }}>
    <h1 className={purple ? "text-xl font-bold text-violet-950 dark:text-violet-100" : "text-3xl font-semibold"}>Live API access and data sharing</h1>
    <p>Live mode sends your project idea, answers, approved requirements, task descriptions, prerequisite outputs and feedback through this server to {providerName}. It does not automatically read your repository or other files. Avoid confidential information. Demo mode uses prepared local responses and is the default.</p>
    <p>{activeProvider === "openrouter" ? "OpenRouter uses free models with shared rate limits." : activeProvider === "gemini" ? "Google's free Gemini tier has daily limits, and Google may use free-tier prompts to improve its products." : "The project owner pays for live requests."} {codeRequired ? "An access code protects these endpoints. Access lasts up to eight hours in this browser." : "No access code is configured for this server, so only your consent is required."} No API key is stored in the browser.</p>
    {codeRequired && <label className="block font-medium">Live access code<input type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} className={purple ? "mt-2 block w-full rounded-xl border border-violet-200 bg-white p-3 outline-none focus:border-violet-500 focus:ring-4 focus:ring-violet-200/60 dark:border-violet-800 dark:bg-slate-950 dark:focus:ring-violet-900" : "mt-2 block w-full rounded-xl border border-slate-300 p-3 dark:border-slate-600"} /></label>}
    <label className="flex items-start gap-3"><input type="checkbox" required className={`mt-1 size-5 shrink-0 ${purple ? "accent-violet-700" : ""}`} checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I understand what will be shared and consent to sending this project context to {providerName}.</span></label>
    {error && <p role="alert" className="text-rose-800 dark:text-rose-300">{error}</p>}
    <button type="submit" disabled={blocked} aria-busy={busy} aria-describedby={blocked ? helpId : undefined} className={purple ? "rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 py-3 font-semibold text-white shadow-[0_8px_20px_rgba(109,40,217,0.2)] disabled:cursor-not-allowed disabled:opacity-50" : "rounded-xl bg-violet-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"}>{busy ? "Checking access…" : "Activate Live API"}</button>
    {blockedReason && <p id={helpId} className="text-sm text-slate-600 dark:text-slate-300">{blockedReason}</p>}
  </form>;
}
