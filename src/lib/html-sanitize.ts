// Pure helpers for generated-site HTML. These are not a general HTML sanitizer:
// the preview iframe relies on CSP + sandbox, and publishing refuses anything
// findExternalResources reports instead of trying to rewrite it.

// Removes document-level directives that can redirect or rebase the page:
// <meta http-equiv="refresh" ...>, <meta http-equiv="Content-Security-Policy"> and <base href>.
export function stripDocumentDirectives(html: string): string {
  return html.replace(/<meta\b(?=[^>]*\bhttp-equiv\s*=)[^>]*>/gi, "").replace(/<base\b[^>]*>/gi, "");
}
function attribute(tag: string, name: string): string | undefined {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`, "i"));
  return match ? (match[1] ?? match[2] ?? match[3] ?? "").trim() : undefined;
}
function describe(kind: string, value?: string) { return value ? `${kind} ${value.slice(0, 120)}` : kind; }
// Lists everything in body markup (and optional CSS) that would make a published
// site reach outside its own file or run markup-embedded handlers:
// <script src>, <link href> to non-data URLs, <iframe>, <object>, <embed>,
// <meta http-equiv>, <base>, inline on*= handlers, CSS @import and remote url().
export function findExternalResources(html: string, css = ""): string[] {
  const found: string[] = [];
  for (const [tag] of html.matchAll(/<[a-zA-Z][^<>]*>/g)) {
    const name = tag.match(/^<([a-zA-Z][\w-]*)/)?.[1].toLowerCase();
    if (!name) continue;
    if (name === "script") { const src = attribute(tag, "src"); if (src !== undefined) found.push(describe("<script src>", src)); }
    else if (name === "link") { const href = attribute(tag, "href"); if (href !== undefined && !/^data:/i.test(href)) found.push(describe("<link href>", href)); }
    else if (name === "iframe" || name === "object" || name === "embed") found.push(describe(`<${name}>`, attribute(tag, name === "object" ? "data" : "src")));
    else if (name === "meta" && attribute(tag, "http-equiv") !== undefined) found.push(describe("<meta http-equiv>", attribute(tag, "http-equiv")));
    else if (name === "base") found.push(describe("<base>", attribute(tag, "href")));
    for (const handler of tag.matchAll(/\s(on[a-zA-Z]+)\s*=/gi)) found.push(describe("inline handler", handler[1]));
  }
  for (const [rule] of css.matchAll(/@import\b[^;]*/gi)) found.push(describe("css @import", rule));
  for (const [, url] of css.replace(/@import\b[^;]*/gi, "").matchAll(/url\(\s*["']?((?:https?:)?\/\/[^"')\s]*)/gi)) found.push(describe("css url()", url));
  return [...new Set(found)];
}
