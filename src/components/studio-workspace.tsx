"use client";
import { useState } from "react";
import { documentHtml, type SiteFiles } from "@/lib/studio";
import { demoBannerText, demoBannerTitle, isPreparedDemo } from "@/lib/studio-demo";
import type { Version } from "./studio-storage";
import { Button, busyHint, fieldStyles, labelStyles, mutedStyles, Panel } from "./studio-ui";

type Props = {
  files: SiteFiles;
  setFiles: (update: (files: SiteFiles) => SiteFiles) => void;
  preview: SiteFiles;
  setPreview: (files: SiteFiles) => void;
  versions: Version[];
  saveVersion: () => void;
  restoreVersion: (version: Version) => void;
  busy: string;
  projectName?: string;
  /** Wide screens show the code editor by default; phones keep it behind a toggle. */
  wide: boolean;
};
type CopyField = { index: number; tag: string; text: string };
const copySelector = "h1,h2,h3,p,a,button,label";
const fileNames: Record<keyof SiteFiles, string> = { html: "index.html", css: "styles.css", js: "script.js" };

export function StudioWorkspace(p: Props) {
  const [tab, setTab] = useState<keyof SiteFiles>("html");
  const [mobile, setMobile] = useState(false);
  const [editorOpen, setEditorOpen] = useState<boolean | null>(null);
  // Copy fields are only valid for the markup they were read from; any other edit discards them.
  const [copy, setCopy] = useState<{ source: string; fields: CopyField[] }>({ source: "", fields: [] });
  const showEditor = editorOpen ?? p.wide;
  const fields = copy.source === p.files.html ? copy.fields : [];
  const editReason = p.busy ? busyHint : undefined;

  function showCopyEditor() {
    const doc = new DOMParser().parseFromString(p.files.html, "text/html");
    const found = [...doc.body.querySelectorAll(copySelector)]
      .map((el, index) => ({ index, tag: el.tagName.toLowerCase(), text: el.textContent || "", simple: el.children.length === 0 }))
      .filter((f) => f.simple && f.text.trim()).slice(0, 40)
      .map(({ index, tag, text }) => ({ index, tag, text }));
    setCopy({ source: p.files.html, fields: found });
  }
  function editCopy(index: number, text: string) {
    const doc = new DOMParser().parseFromString(p.files.html, "text/html");
    const element = doc.body.querySelectorAll(copySelector)[index];
    if (!element) return;
    element.textContent = text;
    const html = /<!doctype|<html/i.test(p.files.html) ? "<!doctype html>" + doc.documentElement.outerHTML : doc.body.innerHTML;
    setCopy((c) => ({ source: html, fields: c.fields.map((f) => f.index === index ? { ...f, text } : f) }));
    p.setFiles((f) => ({ ...f, html }));
  }

  return (
    <Panel aria-label="Website editor and preview" className="grid gap-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-xl font-bold text-violet-950 dark:text-violet-100"><span aria-hidden="true" className="flex size-9 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-200">▣</span>Your Website</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" aria-pressed={mobile} onClick={() => setMobile(!mobile)}>
            {mobile ? "Desktop preview" : "Mobile preview"}
          </Button>
          <Button disabled={!!editReason} disabledReason={editReason} onClick={() => p.setPreview(p.files)}>Apply edits</Button>
        </div>
      </div>
      {isPreparedDemo(p.preview) && (
        <div role="note" data-testid="prepared-example-banner"
          className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm leading-relaxed text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
          <strong className="block">{demoBannerTitle}</strong>
          <span>{demoBannerText(p.projectName)}</span>
        </div>
      )}
      <div className={`mx-auto w-full overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-[0_18px_44px_rgba(91,33,182,0.13)] dark:border-violet-800 ${mobile ? "max-w-sm" : ""}`}>
        <div className="flex h-11 items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-purple-50 px-4 dark:border-violet-900 dark:from-violet-950 dark:to-purple-950">
          <span aria-hidden="true" className="size-2.5 rounded-full bg-rose-400" /><span aria-hidden="true" className="size-2.5 rounded-full bg-amber-400" /><span aria-hidden="true" className="size-2.5 rounded-full bg-emerald-400" />
          <span className="ml-2 min-w-0 flex-1 truncate rounded-lg border border-violet-100 bg-white/80 px-3 py-1 text-center font-mono text-xs text-slate-500 dark:border-violet-800 dark:bg-slate-950/70 dark:text-slate-400">projectpilot.preview</span>
        </div>
        <iframe title="Generated website preview" sandbox="allow-scripts" srcDoc={documentHtml(p.preview)}
          referrerPolicy="no-referrer" className="block h-[40rem] w-full border-0 bg-white xl:h-[46rem]" />
      </div>
      <p className={mutedStyles}>
        Preview blocks network requests, forms, and access to ProjectPilot data. Download to test the website independently.
      </p>
      <details className="rounded-2xl border border-violet-100 bg-violet-50/35 px-4 py-1 dark:border-violet-900 dark:bg-violet-950/20"
        onToggle={(e) => { if (e.currentTarget.open && !p.busy) showCopyEditor(); }}>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100">Edit page text without code</summary>
        <p className={mutedStyles}>
          Change headings, paragraphs, links, and button labels. Apply edits to update the preview. Use the
          code editor for layout, styles, links, and behavior.
        </p>
        <div className="grid gap-3 py-3">
          {fields.length ? fields.map((field) => (
            <label key={field.index} className={labelStyles}>
              {field.tag.toUpperCase()} text
              <input disabled={!!p.busy} value={field.text} maxLength={4000} className={fieldStyles}
                onChange={(e) => editCopy(field.index, e.target.value)} />
            </label>
          )) : <p className={mutedStyles}>No simple text fields found. You can edit all markup below.</p>}
        </div>
      </details>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-base font-bold text-violet-950 dark:text-violet-100">Source code</h3>
        <Button variant="secondary" aria-expanded={showEditor} aria-controls="studio-code-editor"
          onClick={() => setEditorOpen(!showEditor)}>{showEditor ? "Hide code editor" : "Show code editor"}</Button>
      </div>
      {showEditor && (
        <div id="studio-code-editor" className="grid gap-3 rounded-2xl border border-violet-100 bg-violet-50/35 p-4 dark:border-violet-900 dark:bg-violet-950/20">
          <div className="flex flex-wrap gap-2" role="group" aria-label="File selection">
            {(["html", "css", "js"] as const).map((k) => (
              <Button variant="secondary" key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{fileNames[k]}</Button>
            ))}
          </div>
          <label className={labelStyles}>
            Edit {tab.toUpperCase()}
            <textarea spellCheck={false} aria-label={`Edit ${tab.toUpperCase()}`} disabled={!!p.busy} value={p.files[tab]}
              className={`${fieldStyles} min-h-[24rem] resize-y border-slate-800 !bg-slate-950 font-mono text-sm !text-violet-100 focus:border-violet-500`}
              onChange={(e) => p.setFiles((f) => ({ ...f, [tab]: e.target.value }))} />
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={mutedStyles}>Edits save automatically. Apply edits refreshes the preview.</p>
        <Button variant="secondary" disabled={!!editReason} disabledReason={editReason} onClick={p.saveVersion}>Save version</Button>
      </div>
      {p.versions.length > 0 && (
        <label className={`rounded-2xl border border-violet-100 bg-violet-50/35 p-4 dark:border-violet-900 dark:bg-violet-950/20 ${labelStyles}`}>
          Restore a saved version
          <select disabled={!!p.busy} value="" className={fieldStyles}
            onChange={(e) => { const selected = p.versions[Number(e.target.value)]; if (selected) p.restoreVersion(selected); }}>
            <option value="">Choose a version…</option>
            {p.versions.map((v, i) => <option value={i} key={i}>{i + 1}. {v.name}</option>)}
          </select>
        </label>
      )}
    </Panel>
  );
}
