import { stripDocumentDirectives } from '@/lib/html-sanitize';
export type SiteFiles = { html: string; css: string; js: string };
export type StudioMessage = { role: string; text: string; model?: string };
export const starter: SiteFiles = {
  html: '<main><nav><strong>Your next idea</strong><a href="#contact">Let’s talk</a></nav><section><p class="eyebrow">BUILT WITH PROJECTPILOT</p><h1>Something worth<br>putting into the world.</h1><p>A fresh starting point for your business, portfolio, or next big idea. Edit the code or ask your agents to make it yours.</p><a class="button" href="#contact">Get started</a></section><section id="contact"><h2>Make your first move.</h2><p>Tell your story here.</p><button id="hello">Say hello</button><p id="response" aria-live="polite"></p></section></main>',
  css: '*{box-sizing:border-box}body{margin:0;background:#f5f3ec;color:#193d35;font-family:system-ui,sans-serif}main{max-width:1100px;margin:auto;padding:24px}nav{display:flex;justify-content:space-between;align-items:center}a{color:inherit}section{padding:80px 0}h1{font-size:clamp(40px,7vw,88px);line-height:1.05;letter-spacing:-.05em;margin:24px 0}h2{font-size:36px}p{max-width:560px;line-height:1.7}.eyebrow{font-size:12px;letter-spacing:.15em}.button,button{display:inline-block;background:#193d35;color:white;border:0;border-radius:8px;padding:16px 24px;font:inherit;cursor:pointer}a:focus-visible,button:focus-visible{outline:3px solid #ab6b2b;outline-offset:4px}',
  js: 'document.querySelector("#hello")?.addEventListener("click",()=>{document.querySelector("#response").textContent="Hello! Your website is ready to make your own.";});'
};
export function validFiles(value: unknown): value is SiteFiles {
  if (!value || typeof value !== 'object') return false;
  const f = value as SiteFiles;
  return ['html', 'css', 'js'].every(k => typeof f[k as keyof SiteFiles] === 'string' && f[k as keyof SiteFiles].length <= 120000) && f.html.trim().length > 0;
}
// Both preview and published documents carry a CSP that keeps the site self-contained:
// no network (connect-src 'none'), no remote images or fonts, no form posts, no <base>.
// `navigate-to` is not widely supported, so top-level navigation from generated code
// (location.href, <a target="_top">) is constrained by the preview iframe's sandbox
// attribute in the editor, not by this policy.
export const sitePolicy = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'";
export function documentHtml(files: SiteFiles, preview = true) {
  // Escape closing tags so user code cannot escape its intended element.
  const css = files.css.replace(/<\/style/gi, '<\\/style');
  const js = files.js.replace(/<\/script/gi, '<\\/script');
  // Manual edits can reintroduce <meta http-equiv> or <base>; strip them at render time too.
  const html = stripDocumentDirectives(files.html);
  const policy = `<meta http-equiv="Content-Security-Policy" content="${sitePolicy}">`;
  const mode = preview ? '' : '<!-- Published from ProjectPilot Website Studio. This document is self-contained: no external scripts, styles, frames, or network requests. -->';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${policy}<title>ProjectPilot website</title><style>${css}</style></head><body>${mode}${html}<script>${js}</script></body></html>`;
}
// Normalize full-document model replies into the editor's three-file contract.
// This is extraction, not a security sanitizer; preview isolation remains required.
export function normalizeGeneratedFiles(files: SiteFiles): SiteFiles {
  let html = files.html;
  const styles: string[] = [], scripts: string[] = [];
  html = html.replace(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi, (_, code: string) => { styles.push(code.trim()); return ''; });
  html = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi, (tag: string, attributes: string, code: string) => {
    const type = attributes.match(/\btype\s*=\s*["']([^"']+)["']/i)?.[1];
    if (/\bsrc\s*=/i.test(attributes) || (type && !['text/javascript', 'application/javascript'].includes(type.toLowerCase()))) return tag;
    scripts.push(code.trim()); return '';
  });
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  if (body) html = body[1];
  // Redirect/rebase directives never belong in body markup; drop them before they reach the editor.
  html = stripDocumentDirectives(html);
  const combine = (parts: string[]) => [...new Set(parts.map(s => s.trim()).filter(Boolean))].join('\n\n');
  const result = { html: html.trim(), css: combine([files.css, ...styles]), js: combine([files.js, ...scripts]) };
  if (!validFiles(result)) throw new Error('Invalid normalized website files');
  return result;
}
export type StudioMode = 'live' | 'demo';
/** Live needs server access, a configured provider key AND this tab's data-sharing consent; otherwise Studio replays the demo. */
export function studioMode({ access, configured, consent }: { access: boolean; configured: boolean; consent: boolean }): StudioMode {
  return access === true && configured === true && consent === true ? 'live' : 'demo';
}
