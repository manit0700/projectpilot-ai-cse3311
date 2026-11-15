"use client";
import type { GithubAction, GithubState } from "./studio-use-run";
import { Button, busyHint, mutedStyles, unlockHint } from "./studio-ui";

type Props = {
  live: boolean;
  busy: string;
  github: { state: GithubState; repository: string; prUrl: string };
  onAction: (action: GithubAction) => void;
};
const summaryStyles = "min-h-11 cursor-pointer py-2 text-sm font-bold text-violet-950 marker:text-violet-500 dark:text-violet-100";
const containerStyles = "rounded-2xl border border-violet-100 bg-violet-50/45 px-4 py-1 dark:border-violet-900 dark:bg-violet-950/20";

export function GithubSection({ live, busy, github, onAction }: Props) {
  if (github.state === "unavailable") {
    return (
      <details className={containerStyles}>
        <summary className={summaryStyles}>◇ GitHub through MCP · Not enabled in this deployment</summary>
        <p className={`pb-3 ${mutedStyles}`}>
          GitHub publishing is not enabled in this deployment. The server has no GitHub MCP token or
          repository configured, so importing and draft pull requests are unavailable. Download the
          website instead.
        </p>
      </details>
    );
  }
  const connectReason = busy ? busyHint : !live ? unlockHint : undefined;
  const actionReason = busy ? busyHint : !live ? unlockHint : !github.repository ? "Connect GitHub first" : undefined;
  return (
    <details className={containerStyles}>
      <summary className={summaryStyles}>◇ GitHub through MCP</summary>
      <p className={mutedStyles}>
        Connect to the server-configured repository. Import a previously published site or submit your
        current files as a draft pull request. Your default branch stays unchanged.
      </p>
      <div className="my-3 flex flex-wrap gap-2">
        <Button variant="secondary" disabled={!!connectReason} disabledReason={connectReason}
          onClick={() => onAction("connect")}>Connect GitHub</Button>
        <Button variant="secondary" disabled={!!actionReason} disabledReason={actionReason}
          onClick={() => onAction("import")}>Import website</Button>
        <Button disabled={!!actionReason} disabledReason={actionReason} onClick={() => onAction("publish")}>
          Create draft pull request (experimental)
        </Button>
      </div>
      {github.repository && <p className={`pb-3 ${mutedStyles}`}>Repository: {github.repository}</p>}
      {github.prUrl && (
        <a href={github.prUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center pb-3 text-sm font-semibold text-violet-700 underline dark:text-violet-300">
          Open draft pull request
        </a>
      )}
    </details>
  );
}
