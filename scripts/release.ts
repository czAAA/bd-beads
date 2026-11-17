// Ticket 1044, spec 1043, ADR 0096: the only place that knows which commit is a Production release (docs/deploy.md).
// `is-release <commit>` prints whether it adds a release; `production <ref>` prints the commit production may get.
// It reads git only and runs on plain Node, so the Deploy workflow can ask it before `npm ci`.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/** The release record's path in the repo. Its shape is in `docs/agents/pull-requests.md` (Production releases). */
export const RELEASE_RECORD = 'src/data/releases.json';

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

/** The Versions the record lists at a commit: none when the commit has no record, or doesn't exist (a root's parent). */
function releasedVersions(cwd: string, commit: string): Set<string> {
  let text: string;
  try {
    text = git(cwd, ['show', `${commit}:${RELEASE_RECORD}`]);
  } catch {
    return new Set();
  }
  const record: unknown = JSON.parse(text);
  const versions = Array.isArray(record) ? record.map((release: { version?: unknown } | null) => release?.version) : [];
  if (!Array.isArray(record) || !versions.every((version) => typeof version === 'string')) {
    throw new Error(`${RELEASE_RECORD} at ${commit} is not a list of releases, each with its version`);
  }
  return new Set(versions as string[]);
}

/** Whether the commit adds a release: its record lists a Version its first parent's record doesn't. */
export function isRelease(cwd: string, commit: string): boolean {
  const parent = releasedVersions(cwd, `${commit}^1`);
  return [...releasedVersions(cwd, commit)].some((version) => !parent.has(version));
}

/** The commit production may get: the newest on `ref`'s first-parent line that adds a release, else `ref`'s own. */
export function productionCommit(cwd: string, ref: string): string {
  const touching = git(cwd, ['log', '--first-parent', '--format=%H', ref, '--', RELEASE_RECORD]).split('\n').filter(Boolean);
  return touching.find((commit) => isRelease(cwd, commit)) ?? git(cwd, ['rev-parse', '--verify', `${ref}^{commit}`]);
}

function main([question, target]: string[]): void {
  if (!target || (question !== 'is-release' && question !== 'production')) {
    throw new Error('usage: node scripts/release.ts is-release <commit> | production <ref>');
  }
  const cwd = process.cwd();
  console.log(question === 'is-release' ? String(isRelease(cwd, target)) : productionCommit(cwd, target));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
