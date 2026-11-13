"use client";

import { useSyncExternalStore } from "react";

const KEY = "projectpilot-onboarded";
const EVENT = "projectpilot-onboarding";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => { window.removeEventListener(EVENT, onChange); window.removeEventListener("storage", onChange); };
}

function seen(): boolean {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
}

const STEPS = [
  { title: "Describe", short: "Describe", detail: "Share your idea and answer a few clarifying questions." },
  { title: "Review the plan", short: "Review", detail: "Approve requirements and the dependency-ordered tasks." },
  { title: "Approve the work", short: "Approve", detail: "Specialist agents draft outputs; you approve each one." },
];

export function OnboardingStrip() {
  // Server render and first client render assume "seen" so returning visitors never flash the strip.
  const dismissed = useSyncExternalStore(subscribe, seen, () => true);
  if (dismissed) return null;
  const dismiss = () => {
    try { localStorage.setItem(KEY, "1"); } catch { /* storage unavailable: hide for this page view only */ }
    window.dispatchEvent(new Event(EVENT));
  };
  return (
    <section aria-labelledby="onboarding-title" className="mb-3 rounded-xl border border-teal-200 bg-teal-50 px-3 pb-2 pt-1 sm:mb-5 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <h2 id="onboarding-title" className="text-base font-semibold text-teal-950">How ProjectPilot works</h2>
        <button type="button" onClick={dismiss} className="min-h-11 min-w-11 rounded-lg px-2 text-sm font-medium text-teal-900 underline underline-offset-2 hover:bg-teal-100">Got it</button>
      </div>
      <ol className="-mt-1 flex flex-wrap gap-x-4 sm:mt-1 sm:grid sm:grid-cols-3 sm:gap-3">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex items-baseline gap-2 text-sm text-teal-950">
            <span aria-hidden="true" className="font-mono font-semibold">{i + 1}</span>
            <span><span className="font-semibold"><span className="sm:hidden">{step.short}</span><span className="hidden sm:inline">{step.title}</span></span><span className="hidden sm:inline"> · {step.detail}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}
