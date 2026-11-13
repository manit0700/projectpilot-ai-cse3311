import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main id="main-content" className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-4 px-6 py-16">
      <p className="text-sm font-semibold tracking-wide text-teal-800">ProjectPilot AI</p>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">Page not found</h1>
      <p className="text-base leading-relaxed text-slate-600">
        That page does not exist, but your saved project is untouched. Head back to the workspace to keep planning.
      </p>
      <Link href="/" className="inline-flex min-h-11 items-center rounded-xl bg-teal-700 px-5 py-3 font-semibold text-white hover:bg-teal-800">
        Back to ProjectPilot AI
      </Link>
    </main>
  );
}
