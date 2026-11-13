import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { requireLiveAccess } from '@/lib/live-access';
import { documentHtml, validFiles } from '@/lib/studio';
export const runtime = 'nodejs';
export const maxDuration = 60;
export async function POST(request: Request) {
  const denied = requireLiveAccess(request); if (denied) return denied;
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return Response.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  const token = process.env.GITHUB_MCP_TOKEN?.trim();
  const repository = process.env.GITHUB_MCP_REPOSITORY?.trim();
  if (!token || !repository || !/^[\w.-]+\/[\w.-]+$/.test(repository)) return Response.json({ error: 'Configure GITHUB_MCP_TOKEN and GITHUB_MCP_REPOSITORY on the server. Use a token scoped to the intended repository.' }, { status: 503 });
  let input;
  try { const raw = await request.text(); if (raw.length > 400000) return Response.json({ error: 'Website is too large.' }, { status: 413 }); input = JSON.parse(raw); }
  catch { return Response.json({ error: 'Invalid request.' }, { status: 400 }); }
  if (!['connect', 'import', 'publish'].includes(input?.action) || (input.action === 'publish' && (!validFiles(input.files) || input.confirm !== true))) return Response.json({ error: 'Choose a valid action and explicitly approve publishing.' }, { status: 400 });
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
    await call('push_files', { owner, repo, branch: createdBranch, message: 'Add ProjectPilot generated website for review', files: [{ path: 'projectpilot-site/index.html', content: documentHtml(input.files, false) }] });
    const result = await call('create_pull_request', { owner, repo, base, head: createdBranch, title: 'Review ProjectPilot website', body: 'Generated in Website Studio and submitted by the user for review. Files are in projectpilot-site/index.html. Inspect and test the website before merging. Source review does not constitute browser testing.', draft: true });
    // Construct the URL from our fixed repository and returned PR number, never model text.
    const text = (result.content as { type: string; text?: string }[]).filter(b => b.type === 'text').map(b => b.text || '').join('\n');
    let number: unknown;
    try { const data = JSON.parse(text); number = data.number; if (!number && typeof data.url === 'string') number = data.url.match(/\/pulls?\/(\d+)$/)?.[1]; } catch {}
    const pull = Number(number);
    return Response.json({ repository, branch: createdBranch, url: Number.isSafeInteger(pull) && pull > 0 ? `https://github.com/${repository}/pull/${pull}` : `https://github.com/${repository}/pulls`, published: true });
  } catch {
    return Response.json({ error: createdBranch ? `GitHub operation did not finish. The branch ${createdBranch} may contain your files; inspect it before retrying.` : 'Could not complete GitHub MCP operation. Check the token, repository permissions, base branch, and whether projectpilot-site/index.html exists for import.' }, { status: 502 });
  } finally { await client.close().catch(() => {}); }
}
