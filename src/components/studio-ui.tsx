"use client";
import { useId, useSyncExternalStore, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

// Shared Website Studio primitives that reuse the planning app's visual language.
const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm " +
  "font-semibold transition motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-50";
export const buttonStyles = {
  primary: `${base} bg-gradient-to-r from-violet-700 to-purple-600 text-white shadow-[0_8px_20px_rgba(109,40,217,0.2)] hover:from-violet-800 hover:to-purple-700`,
  secondary: `${base} border border-violet-200 bg-white text-violet-800 hover:border-violet-400 hover:bg-violet-50 ` +
    "aria-pressed:border-violet-600 aria-pressed:bg-violet-100 aria-pressed:ring-1 aria-pressed:ring-violet-600 dark:border-violet-800 dark:bg-slate-950 dark:text-violet-200 dark:hover:bg-violet-950",
};
export const mutedStyles = "text-sm leading-relaxed text-slate-600 dark:text-slate-300";
export const labelStyles = "block text-sm font-semibold text-violet-950 dark:text-violet-100";
export const fieldStyles = "mt-2 block w-full min-w-0 rounded-xl border border-violet-200 bg-white p-3 " +
  "text-base font-normal leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 " +
  "focus:border-violet-500 focus:ring-4 focus:ring-violet-200/60 disabled:bg-violet-50/60 read-only:bg-violet-50/60 " +
  "dark:border-violet-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:ring-violet-900 dark:disabled:bg-violet-950/20 dark:read-only:bg-violet-950/20";
export const unlockHint = "Unlock live agents above to enable";
export const busyHint = "Agents are working. Wait for them or stop them.";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof buttonStyles;
  /** Shown under the button and linked through aria-describedby whenever the button is disabled. */
  disabledReason?: string;
};
export function Button({ variant = "primary", disabledReason, disabled, className = "", children, ...rest }: ButtonProps) {
  const id = useId();
  const explain = Boolean(disabled && disabledReason);
  const button = (
    <button type="button" {...rest} disabled={disabled} className={`${buttonStyles[variant]} ${className}`}
      aria-describedby={explain ? id : rest["aria-describedby"]}>
      {children}
    </button>
  );
  if (!explain) return button;
  return (
    <div className="inline-flex max-w-full flex-col gap-1">
      {button}
      <p id={id} className="max-w-72 text-sm text-slate-600 dark:text-slate-300">{disabledReason}</p>
    </div>
  );
}

export function Panel({ children, className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`min-w-0 rounded-[1.75rem] border border-violet-100 bg-white/95 p-5 shadow-[0_16px_42px_rgba(91,33,182,0.09)] dark:border-violet-900 dark:bg-slate-950/95 ${className}`} {...rest}>
      {children}
    </section>
  );
}

// True at Tailwind's `sm` breakpoint and above. Assumes a wide screen during server rendering.
const query = "(min-width: 640px)";
function subscribe(callback: () => void) {
  const media = matchMedia(query);
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
export function useWide() {
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches, () => true);
}
