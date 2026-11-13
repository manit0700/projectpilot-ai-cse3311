// A deliberately small Markdown reader. It powers two things: the Final screen (rendered with
// React elements, never innerHTML) and the extraction of code files from agent outputs.

export type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "code"; lang: string; filename?: string; code: string };

export type InlineToken = { type: "text" | "bold" | "code"; text: string };

const FILE_HINT = /(?:^|\s)(?:filename|file|title|path)\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s"']+))/i;
const COMMENT_HINT = /^\s*(?:\/\/|#|--|;|\/\*+|<!--)\s*(?:file(?:name)?|path)\s*:\s*(.+?)\s*(?:\*\/|-->)?\s*$/i;
const KNOWN_EXTENSIONS = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "json", "css", "scss", "html", "md", "sql", "py", "sh", "yml", "yaml", "toml", "prisma", "txt", "go", "rs", "java", "kt", "swift", "rb", "php", "c", "cpp", "h", "vue", "svelte", "xml", "csv", "ini", "env", "gitignore", "dockerfile"]);

/** A relative path safe to write inside a download: no absolute paths, no '..', plain characters only. */
export function sanitizeRelativePath(value: string): string | null {
  const parts = value.trim().replace(/^`+|`+$/g, "").replace(/\\/g, "/").split("/").filter((p) => p !== "" && p !== ".");
  if (!parts.length || parts.length > 8 || value.trim().startsWith("/") || /^[A-Za-z]:/.test(value.trim())) return null;
  if (parts.some((p) => p === ".." || p.length > 80 || !/^[A-Za-z0-9._@+-][A-Za-z0-9._@+ -]*$/.test(p))) return null;
  const last = parts[parts.length - 1];
  return last.includes(".") || /^(?:Dockerfile|Makefile)$/.test(last) ? parts.join("/") : null;
}

/** A heading such as '### src/lib/db.ts' names the file in the code block that follows. */
function headingPath(heading: string): string | null {
  const candidate = heading.trim().replace(/^`+|`+$/g, "");
  if (/\s/.test(candidate)) return null;
  const extension = candidate.split(".").pop()?.toLowerCase() ?? "";
  if (!KNOWN_EXTENSIONS.has(extension)) return null;
  // 'Next.js' is a name, not a file: bare names must be lowercase, nested paths may be anything safe.
  if (!candidate.includes("/") && candidate !== candidate.toLowerCase()) return null;
  return sanitizeRelativePath(candidate);
}

export function parseMarkdownBlocks(source: string): MarkdownBlock[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  const flush = () => { if (paragraph.length) { blocks.push({ type: "paragraph", text: paragraph.join("\n") }); paragraph = []; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = /^\s{0,3}(`{3,}|~{3,})\s*(.*)$/.exec(line);
    if (fence) {
      flush();
      const marker = fence[1], info = fence[2].trim();
      const body: string[] = [];
      for (i++; i < lines.length && !new RegExp(`^\\s{0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i]); i++) body.push(lines[i]);
      const hint = FILE_HINT.exec(info);
      let filename = hint ? sanitizeRelativePath(hint[1] ?? hint[2] ?? hint[3]) ?? undefined : undefined;
      let lang = info.split(/[\s{]/)[0].replace(/[:=].*$/, "");
      if (/^(?:filename|file|title|path)$/i.test(lang)) lang = "";
      if (!filename && /^[\w+#-]+:[^\s]+$/.test(info.split(/\s/)[0])) {
        // ```ts:src/app.ts
        filename = sanitizeRelativePath(info.split(/\s/)[0].split(":").slice(1).join(":")) ?? undefined;
      }
      const first = COMMENT_HINT.exec(body[0] ?? "");
      if (first) {
        const fromComment = sanitizeRelativePath(first[1]);
        if (fromComment) { filename = filename ?? fromComment; body.shift(); }
      }
      if (lang === "" && filename) lang = filename.split(".").pop() ?? "";
      blocks.push({ type: "code", lang, filename, code: body.join("\n") });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) { flush(); blocks.push({ type: "heading", level: heading[1].length, text: heading[2] }); continue; }
    if (/^\s*$/.test(line)) { flush(); continue; }
    const item = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = Boolean(item[2]);
      const items = [item[3]];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const more = /^\s*(?:([-*+])|(\d+)[.)])\s+(.*)$/.exec(next);
        if (more && Boolean(more[2]) === ordered) { items.push(more[3]); i++; }
        else if (/^\s{2,}\S/.test(next) && !more) { items[items.length - 1] += `\n${next.trim()}`; i++; }
        else break;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }
    paragraph.push(line);
  }
  flush();

  // A path-like heading directly before an unnamed code block names that block.
  blocks.forEach((block, index) => {
    const previous = blocks[index - 1];
    if (block.type === "code" && !block.filename && previous?.type === "heading") {
      const path = headingPath(previous.text);
      if (path) block.filename = path;
    }
  });
  return blocks;
}

export function parseInline(value: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  for (const part of value.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/)) {
    if (!part) continue;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) tokens.push({ type: "bold", text: part.slice(2, -2) });
    else if (part.startsWith("`") && part.endsWith("`") && part.length > 2) tokens.push({ type: "code", text: part.slice(1, -1) });
    else tokens.push({ type: "text", text: part });
  }
  return tokens;
}
