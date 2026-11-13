"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useProjectStore } from "@/lib/store";
import { createStudioHandoff, handoffKey } from "@/lib/studio-handoff";

export function StudioHandoffButton({ disabled = false }: { disabled?: boolean }) {
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
    <section className="mt-6 rounded-xl border border-teal-200 bg-teal-50 p-4">
      <h2 className="text-lg font-semibold">Ready to turn this idea into a website?</h2>
      <p className="mt-2">
        Confirm your requirements and task plan here, then carry them into Website Studio. Agents design, build
        and review a static website from this plan while you edit it. Static website generation does not
        implement a backend or database.
      </p>
      <button type="button" disabled={disabled || store.busy} onClick={openStudio}
        className="mt-4 min-h-11 rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
        Confirm idea & open Website Studio
      </button>
      {error && <p role="alert" className="mt-3 text-rose-800">{error}</p>}
    </section>
  );
}
