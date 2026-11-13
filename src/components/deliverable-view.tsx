"use client";

import { Fragment, useState, type ReactNode } from "react";
import { parseInline, parseMarkdownBlocks, type MarkdownBlock } from "@/lib/export-markdown";

// Renders an agent deliverable with React elements only (never innerHTML): headings, lists, bold,
// inline code and fenced code blocks, with newlines preserved and copy buttons.

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = value;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyButton({ value, label = "Copy", ariaLabel, className = "" }: { value: string; label?: string; ariaLabel?: string; className?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  async function copy() {
    setState((await copyToClipboard(value)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }
  return (
    <button type="button" onClick={copy} aria-label={ariaLabel ?? label}
      className={`min-h-9 rounded-lg border border-slate-300 bg-white px-3 py-1 text-sm font-medium text-slate-800 hover:bg-slate-50 ${className}`}>
      <span aria-live="polite">{state === "copied" ? "Copied" : state === "failed" ? "Copy failed" : label}</span>
    </button>
  );
}

function Inline({ text }: { text: string }) {
  return <>{parseInline(text).map((token, i) => token.type === "bold" ? <strong key={i}>{token.text}</strong> : token.type === "code" ? <code key={i} className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em]">{token.text}</code> : <Fragment key={i}>{token.text}</Fragment>)}</>;
}

function Block({ block }: { block: MarkdownBlock }): ReactNode {
  switch (block.type) {
    case "heading":
      return <p className={`mt-3 font-semibold text-slate-900 ${block.level <= 2 ? "text-base" : "text-sm"}`} role="heading" aria-level={Math.min(block.level + 3, 6)}><Inline text={block.text} /></p>;
    case "paragraph":
      return <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-slate-800"><Inline text={block.text} /></p>;
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return <Tag className={`mt-2 space-y-1 pl-6 text-base leading-relaxed text-slate-800 ${block.ordered ? "list-decimal" : "list-disc"}`}>{block.items.map((item, i) => <li key={i} className="whitespace-pre-wrap break-words"><Inline text={item} /></li>)}</Tag>;
    }
    case "code":
      return (
        <figure className="mt-3 overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
          <figcaption className="flex items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1 text-sm text-slate-700">
            <span className="min-w-0 truncate font-mono">{block.filename ?? (block.lang || "code")}</span>
            <CopyButton value={block.code} ariaLabel={`Copy ${block.filename ?? (block.lang || "code")}`} />
          </figcaption>
          <pre className="overflow-x-auto p-3 text-sm leading-relaxed"><code className="font-mono">{block.code}</code></pre>
        </figure>
      );
  }
}

export function DeliverableView({ title, text, humanEdited = false, badge, children }: { title: string; text: string; humanEdited?: boolean; badge?: string; children?: ReactNode }) {
  const blocks = parseMarkdownBlocks(text);
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="min-w-0 text-base font-semibold text-slate-900">
          {title}
          {badge && <span className="ml-2 rounded-full border border-teal-700 px-2 py-0.5 text-xs font-medium text-teal-800">{badge}</span>}
          {humanEdited && <span className="ml-2 rounded-full border border-amber-700 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">Edited by you</span>}
        </h3>
        <CopyButton value={text} label="Copy all" ariaLabel={`Copy all of ${title}`} />
      </header>
      <div>{blocks.length ? blocks.map((block, i) => <Block key={i} block={block} />) : <p className="mt-2 text-slate-600">No content.</p>}</div>
      {children}
    </article>
  );
}
