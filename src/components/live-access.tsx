"use client";
import { useEffect, useState } from "react";

export function LiveAccess({ onUnlocked, provider = "auto" }: { onUnlocked: () => void; provider?: "openai" | "openrouter" | "auto" }) {
  const [activeProvider, setActiveProvider] = useState(provider === "openrouter" ? "openrouter" : "openai");
  useEffect(() => {
    if (provider !== "auto") return;
    let cancelled = false;
    fetch("/api/manager").then(r => r.json()).then(s => { if (!cancelled) setActiveProvider(s.provider === "openrouter" ? "openrouter" : "openai"); }).catch(() => {});
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
  return <form aria-label="Live API access" className="max-w-2xl space-y-5" onSubmit={async (event) => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch("/api/live-access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, consent }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not unlock Live API.");
      setCode(""); onUnlocked();
    } catch (error) { setError(error instanceof Error ? error.message : "Access request failed. Try again."); }
    finally { setBusy(false); }
  }}>
    <h1 className="text-3xl font-semibold">Live API access and data sharing</h1>
    <p>Live mode sends your project idea, answers, approved requirements, task descriptions, prerequisite outputs and feedback through this server to {activeProvider === "openrouter" ? "OpenRouter and its model providers" : "OpenAI"}. It does not automatically read your repository or other files. Avoid confidential information. Demo mode uses prepared local responses.</p>
    <p>{activeProvider === "openrouter" ? "OpenRouter uses free models with shared rate limits." : "The project owner pays for live requests."} {codeRequired ? "An access code protects these endpoints. Access lasts up to eight hours in this browser." : "Local access does not require a password."} No API key is stored in the browser.</p>
    {codeRequired && <label className="block font-medium">Live access code<input type="password" autoComplete="current-password" value={code} onChange={(e) => setCode(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-300 p-3" /></label>}
    <label className="flex items-start gap-3"><input type="checkbox" className="mt-1 size-5 shrink-0" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I understand what will be shared and consent to sending this project context to {activeProvider === "openrouter" ? "OpenRouter and its model providers" : "OpenAI"}.</span></label>
    {error && <p role="alert" className="text-rose-800">{error}</p>}
    <button type="submit" disabled={!consent || busy} aria-busy={busy} className="rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? "Checking access…" : "Unlock Live API"}</button>
  </form>;
}
