// Merge order from git (ticket 1045, spec 1043, ADR 0096): the commits on HEAD's first-parent line that added a Release
// note's file, oldest first. Only the notes not in the release record need it; the number rule is scripts/versions.ts.
import { git, RELEASE_RECORD } from './release.ts';

/** Where the Release notes since 1.0.0 live, one file per ticket; the ones from before 1.0.0 sit in `before-1.0.0/`. */
export const NOTES_DIR = 'src/data/releaseNotes';

/** The commit that added `version` to the release record: the oldest on the line whose record lists it. */
function releaseCommit(cwd: string, ref: string, version: string): string | undefined {
  const touching = git(cwd, ['log', '--first-parent', '--reverse', '--format=%H', ref, '--', RELEASE_RECORD]).split('\n').filter(Boolean);
  return touching.find((commit) => {
    const record = JSON.parse(git(cwd, ['show', `${commit}:${RELEASE_RECORD}`])) as { version: string }[];
    return record.some((release) => release.version === version);
  });
}

/** The named notes git can place, in merge order on `ref`'s line (two in one commit by file name), and how many merged
 * before the commit that added `newestRelease` (all while it isn't made, none with no release). Leaves out a note not
 * committed; null when git can't be read: no repository, or a shallow one, whose oldest commit seems to add every file. */
export function noteOrder(
  cwd: string,
  names: readonly string[],
  newestRelease: string | undefined,
  ref = 'HEAD',
): { placed: string[]; beforeRelease: number } | null {
  let lines: string[];
  let commits: Map<string, number>;
  try {
    if (git(cwd, ['rev-parse', '--is-shallow-repository']) !== 'false') return null;
    commits = new Map(git(cwd, ['rev-list', '--first-parent', '--reverse', ref]).split('\n').map((commit, i) => [commit, i]));
    lines = git(cwd, ['log', '--first-parent', '--diff-merges=first-parent', '--no-renames', '--diff-filter=A', '--reverse', '--name-only', '--format=commit %H', ref, '--', NOTES_DIR]).split('\n');
  } catch {
    return null;
  }
  const wanted = new Set(names);
  const added: { name: string; at: number }[] = [];
  let at = -1;
  for (const line of lines) {
    if (line.startsWith('commit ')) at = commits.get(line.slice('commit '.length)) ?? -1;
    const name = line.startsWith(`${NOTES_DIR}/`) && line.endsWith('.json') ? line.slice(NOTES_DIR.length + 1, -'.json'.length) : '';
    if (!name.includes('/') && wanted.delete(name)) added.push({ name, at });
  }
  added.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
  const release = newestRelease === undefined ? undefined : releaseCommit(cwd, ref, newestRelease);
  const releaseAt = newestRelease === undefined ? -Infinity : release === undefined ? Infinity : (commits.get(release) ?? Infinity);
  return { placed: added.map((note) => note.name), beforeRelease: added.filter((note) => note.at < releaseAt).length };
}
