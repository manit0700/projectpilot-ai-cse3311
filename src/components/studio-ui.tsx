"use client";
import { useId, useSyncExternalStore, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

// Shared Website Studio primitives that reuse the planning app's visual language.
const base = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm " +
  "font-semibold disabled:cursor-not-allowed disabled:opacity-50";
export const buttonStyles = {
  primary: `${base} bg-teal-700 text-white hover:bg-teal-800`,
  secondary: `${base} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 ` +
    "aria-pressed:border-teal-700 aria-pressed:ring-1 aria-pressed:ring-teal-700",
};
export const mutedStyles = "text-sm leading-relaxed text-slate-600";
export const labelStyles = "block text-sm font-semibold text-slate-800";
export const fieldStyles = "mt-2 block w-full min-w-0 rounded-xl border border-slate-300 bg-white p-3 " +
  "text-base font-normal leading-relaxed text-slate-900 disabled:bg-slate-50 read-only:bg-slate-50";
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
      <p id={id} className="max-w-72 text-sm text-slate-600">{disabledReason}</p>
    </div>
  );
}

export function Panel({ children, className = "", ...rest }: HTMLAttributes<HTMLElement>) {
  return (
    <section className={`min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} {...rest}>
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
