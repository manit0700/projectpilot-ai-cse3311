import type { ProjectContext } from './types';
import { requirementsReady, validateTasks } from './workflow';
export const handoffKey = 'projectpilot-studio-handoff-v1';
export type StudioHandoff = { id: string; projectId: string; title: string; brief: string; plan: string; confirmedAt: string };
export function validHandoff(s: unknown): s is StudioHandoff {
  if (!s || typeof s !== 'object') return false;
  const v = s as StudioHandoff;
  return ['id', 'projectId', 'title', 'brief', 'plan', 'confirmedAt'].every(k => typeof v[k as keyof StudioHandoff] === 'string' && v[k as keyof StudioHandoff].trim().length > 0) && v.brief.length <= 12000 && v.plan.length <= 18000;
}
export function createStudioHandoff(context: ProjectContext): StudioHandoff {
  if (!context.project.id || !requirementsReady(context) || !context.tasks.length || validateTasks(context.tasks)) throw new Error('Approve the requirements and review a valid task plan before building a website.');
  const brief = `${context.project.title}\n${context.project.description}\nTarget users: ${context.project.targetUser}`;
  const plan = [context.project.approvedSummary, 'APPROVED REQUIREMENTS', ...context.requirements.map(r => `- ${r.text}`), 'USER-CONFIRMED TASK PLAN', ...context.tasks.map(t => `${t.order}. ${t.title} (${t.ownerAgent})\n${t.description}\nExpected: ${t.expectedOutput}\nConstraints: ${t.constraints}\nDependencies: ${t.dependencies.join(', ') || 'None'}`), 'Website scope: implement the browser-facing portion as a static HTML/CSS/JavaScript site. Explicitly identify backend or database requirements that cannot run in this preview.'].join('\n\n');
  if (brief.length > 12000 || plan.length > 18000) throw new Error('This plan is too large for Website Studio. Shorten the task descriptions before continuing.');
  return { id: crypto.randomUUID(), projectId: context.project.id, title: context.project.title, brief, plan, confirmedAt: new Date().toISOString() };
}
