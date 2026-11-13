import { createZip } from "./zip";
import { orderedTasks, taskTitle, type ExportFile } from "./export-common";
import { parseMarkdownBlocks } from "./export-markdown";
import type { WorkflowState } from "./workflow";

// Per-file deliverables: fenced code blocks that name a file become real files in a download.
// Supported hints: ```ts filename=src/a.ts, a '### src/a.ts' heading before the block, or a first
// line such as '// file: src/a.ts'.

export interface CodeFile { path: string; language: string; content: string; taskLabel: string }

export function extractCodeFiles(s: WorkflowState): CodeFile[] {
  const found = new Map<string, CodeFile>();
  for (const task of orderedTasks(s)) {
    const outputs = s.outputs.filter((o) => o.taskId === task.id && o.approved !== "rejected");
    // The approved output wins; otherwise the latest draft.
    const output = outputs.find((o) => o.approved === "approved") ?? outputs[outputs.length - 1];
    if (!output) continue;
    for (const block of parseMarkdownBlocks(output.summary)) {
      if (block.type !== "code" || !block.filename) continue;
      // A later task replaces an earlier file with the same path.
      found.set(block.filename, { path: block.filename, language: block.lang, content: block.code.endsWith("\n") ? block.code : `${block.code}\n`, taskLabel: taskTitle(task) });
    }
  }
  return [...found.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** Folder tree as indented text, for the README inside the archive and the UI list. */
export function codeTree(files: CodeFile[]): string {
  const lines: string[] = [];
  const printed = new Set<string>();
  for (const file of files) {
    const parts = file.path.split("/");
    parts.forEach((part, depth) => {
      const key = parts.slice(0, depth + 1).join("/");
      if (printed.has(key)) return;
      printed.add(key);
      lines.push(`${"  ".repeat(depth)}${part}${depth < parts.length - 1 ? "/" : ""}`);
    });
  }
  return lines.join("\n");
}

export function codeFilesZip(s: WorkflowState, now = new Date()): Uint8Array {
  const files = extractCodeFiles(s);
  if (!files.length) throw new Error("No code files with a file name were found in the agent outputs.");
  const readme = `# Code files from ProjectPilot AI\n\nExtracted from fenced code blocks that named a file. Review every file before running it.\n\n${files.map((f) => `- \`${f.path}\` (from ${f.taskLabel})`).join("\n")}\n\n\`\`\`\n${codeTree(files)}\n\`\`\`\n`;
  const entries: ExportFile[] = [...files.map((f) => ({ name: f.path, content: f.content })), { name: files.some((f) => f.path === "FILES.md") ? "_FILES.md" : "FILES.md", content: readme }];
  return createZip(entries.map((e) => ({ name: e.name, data: e.content, modified: now })));
}
