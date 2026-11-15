"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectStore } from "@/lib/store";
import { createStudioHandoff, handoffKey } from "@/lib/studio-handoff";

export function StudioHandoffButton({ disabled = false, variant = "default" }: { disabled?: boolean; variant?: "default" | "purple" }) {
  const store = useProjectStore();
  const router = useRouter();
  const [error, setError] = useState("");
  function openStudio() {
    try {
      const handoff = createStudioHandoff(store);
      sessionStorage.setItem(handoffKey, JSON.stringify(handoff));
      router.push("/studio?from=planning");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not transfer the plan."); }
  }
  return (
    <section className={variant === "purple" ? "mt-6 rounded-2xl border border-violet-200 bg-violet-50/70 p-5 dark:border-violet-900 dark:bg-violet-950/30" : "mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4 dark:bg-teal-950/50 dark:border-teal-800"}>
      <h2 className={variant === "purple" ? "text-lg font-semibold text-violet-950 dark:text-violet-100" : "text-lg font-semibold"}>Ready to turn this idea into a website?</h2>
      <p className={variant === "purple" ? "mt-2 leading-relaxed text-slate-600 dark:text-slate-300" : "mt-2"}>
        Confirm your requirements and task plan here, then carry them into Website Studio. Agents design, build
        and review a static website from this plan while you edit it. Static website generation does not
        implement a backend or database.
      </p>
      <button type="button" disabled={disabled || store.busy} onClick={openStudio}
        className={variant === "purple" ? "mt-4 min-h-11 rounded-xl border border-violet-300 bg-white px-5 py-3 font-semibold text-violet-800 transition hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200" : "mt-4 min-h-11 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"}>
        Confirm idea & open Website Studio
      </button>
      {error && <p role="alert" className="mt-3 text-rose-800 dark:text-rose-300">{error}</p>}
    </section>
  );
}
