import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { requireLiveAccess } from '@/lib/live-access';
import { documentHtml, validFiles, type SiteFiles } from '@/lib/studio';
import { failure, readJsonBody, sameOrigin } from '@/lib/api-guard';
import { findExternalResources } from '@/lib/html-sanitize';
import { rateLimited, studioLimiter } from '@/lib/rate-limit';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = requireLiveAccess(request); if (denied) return denied;
  const foreign = sameOrigin(request); if (foreign) return foreign;
  const limited = rateLimited(studioLimiter, request); if (limited) return limited;
  const token = process.env.GITHUB_MCP_TOKEN?.trim();
  const repository = process.env.GITHUB_MCP_REPOSITORY?.trim();
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return failure('Configure GITHUB_MCP_TOKEN and GITHUB_MCP_REPOSITORY on the server. Use a token scoped to the intended repository.', 503, 'auth');
  const body = await readJsonBody(request, 400000, 'Website is too large.'); if (!body.ok) return body.response;
  const input = body.value as { action?: unknown; files?: unknown; confirm?: unknown };
  if (typeof input.action !== 'string' || !['connect', 'import', 'publish'].includes(input.action) || (input.action === 'publish' && (!validFiles(input.files) || input.confirm !== true))) return failure('Choose a valid action and explicitly approve publishing.', 400, 'invalid');
  if (input.action === 'publish' && validFiles(input.files)) {
    // Published output must be self-contained: model or manual edits that pull remote code, frame other sites, or embed handlers are refused rather than pushed.
    const external = findExternalResources(input.files.html, input.files.css);
    if (external.length) return failure(`The website is not self-contained. Remove external scripts, stylesheets, frames, embeds, meta/base directives and inline event handlers before publishing: ${external.slice(0, 5).join('; ')}`, 400, 'invalid', { external });
  }
  const [owner, repo] = repository.split('/');
  const base = process.env.GITHUB_MCP_BASE_BRANCH?.trim() || 'main';
  const client = new Client({ name: 'projectpilot-website-studio', version: '1.0.0' });
  let createdBranch = '';
  try {
    const transport = new StreamableHTTPClientTransport(new URL('https://api.githubcopilot.com/mcp/'), {
      requestInit: { headers: { Authorization: `Bearer ${token}`, 'X-MCP-Tools': 'get_file_contents,create_branch,push_files,create_pull_request', ...(input.action !== 'publish' ? { 'X-MCP-Readonly': 'true' } : {}) }, signal: AbortSignal.any([request.signal, AbortSignal.timeout(52000)]) },
      reconnectionOptions: { maxRetries: 0, initialReconnectionDelay: 1000, maxReconnectionDelay: 1000, reconnectionDelayGrowFactor: 1 }
    });
    await client.connect(transport, { timeout: 12000 });
    const listed = await client.listTools({}, { timeout: 12000 });
    const available = new Set(listed.tools.map(t => t.name));
    const call = async (name: string, args: Record<string, unknown>) => {
      if (!available.has(name)) throw new Error('Missing required MCP tool');
      const result = await client.callTool({ name, arguments: args }, undefined, { timeout: 12000 });
      if (result.isError) throw new Error('GitHub tool failed');
      return result;
    };
    if (input.action === 'connect') return Response.json({ repository, tools: [...available], connected: true });
    if (input.action === 'import') {
      // Only import Studio's generated artifact; arbitrary repository files and secrets are not exposed.
      const result = await call('get_file_contents', { owner, repo, path: 'projectpilot-site/index.html', ref: `refs/heads/${base}` });
      const blocks = result.content as { type: string; text?: string; resource?: { text?: string } }[];
      let html = blocks.map(b => b.type === 'resource' ? b.resource?.text || '' : '').join('\n');
      if (!html) {
        const text = blocks.filter(b => b.type === 'text').map(b => b.text || '').join('\n');
        try { const parsed = JSON.parse(text); if (typeof parsed.content === 'string') html = parsed.encoding === 'base64' ? Buffer.from(parsed.content, 'base64').toString('utf8') : parsed.content; } catch { if (/<!doctype|<html/i.test(text)) html = text.slice(text.search(/<!doctype|<html/i)); }
      }
      if (!html || html.length > 120000) throw new Error('No editable HTML returned');
      return Response.json({ repository, files: { html, css: '', js: '' } });
    }
    createdBranch = `projectpilot/site-${crypto.randomUUID()}`;
    await call('create_branch', { owner, repo, from_branch: base, branch: createdBranch });
    const files = input.files as SiteFiles;
    await call('push_files', { owner, repo, branch: createdBranch, message: 'Add ProjectPilot generated website for review', files: [{ path: 'projectpilot-site/index.html', content: documentHtml(files, false) }] });
    const result = await call('create_pull_request', { owner, repo, base, head: createdBranch, title: 'Review ProjectPilot website', body: 'Generated in Website Studio and submitted by the user for review. Files are in projectpilot-site/index.html. The site is self-contained: a single HTML file with inline CSS and JavaScript, a Content-Security-Policy meta tag, and no external scripts, stylesheets, frames, or network requests (verified server-side before publishing). Inspect and test the website before merging. Source review does not constitute browser testing.', draft: true });
    // Construct the URL from our fixed repository and returned PR number, never model text.
    const text = (result.content as { type: string; text?: string }[]).filter(b => b.type === 'text').map(b => b.text || '').join('\n');
    let number: unknown;
    try { const data = JSON.parse(text); number = data.number; if (!number && typeof data.url === 'string') number = data.url.match(/\/pulls?\/(\d+)$/)?.[1]; } catch {}
    const pull = Number(number);
    return Response.json({ repository, branch: createdBranch, url: Number.isSafeInteger(pull) && pull > 0 ? `https://github.com/${repository}/pull/${pull}` : `https://github.com/${repository}/pulls`, published: true });
  } catch {
    return failure(createdBranch ? `GitHub operation did not finish. The branch ${createdBranch} may contain your files; inspect it before retrying.` : 'Could not complete GitHub MCP operation. Check the token, repository permissions, base branch, and whether projectpilot-site/index.html exists for import.', 502, 'transient');
  } finally { await client.close().catch(() => {}); }
}
