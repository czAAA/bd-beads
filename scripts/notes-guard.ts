// Ticket 1045, ADR 0096: a merged Release note's file name and kind are final, so a branch keeps every note on `main`
// (its wording may change). releaseNotes.test.ts checks the released ones without git; this covers the ones since.
// `node scripts/notes-guard.ts <base> [head]` prints what is wrong and fails, or prints nothing.
import { fileURLToPath } from 'node:url';
import { NOTES_DIR } from './noteOrder.ts';
import { git } from './release.ts';

/** Every note at `ref`, in either folder, by file name, with its kind (none for a note from before 1.0.0). */
function notesAt(cwd: string, ref: string): Map<string, string | undefined> {
  const paths = git(cwd, ['ls-tree', '-r', '--name-only', ref, '--', NOTES_DIR]).split('\n').filter((path) => path.endsWith('.json'));
  return new Map(
    paths.map((path) => [
      path.slice(path.lastIndexOf('/') + 1, -'.json'.length),
      (JSON.parse(git(cwd, ['show', `${ref}:${path}`])) as { kind?: string }).kind,
    ]),
  );
}

/** What `head` does to the notes on `base`: each note missing (or renamed, which leaves its old name missing) or changed in kind. */
export function notesGuard(cwd: string, base: string, head: string): string[] {
  const after = notesAt(cwd, head);
  return [...notesAt(cwd, base)].flatMap(([name, kind]) => {
    if (!after.has(name)) return [`${name} is on main but missing here`];
    const now = after.get(name);
    return now === kind ? [] : [`${name} is ${kind ?? 'without a kind'} on main but ${now ?? 'without a kind'} here`];
  });
}

function main([base, head = 'HEAD']: string[]): void {
  if (!base) throw new Error('usage: node scripts/notes-guard.ts <base> [head]');
  const problems = notesGuard(process.cwd(), base, head);
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) {
    console.error('A merged Release note is never deleted, renamed or given another kind (docs/agents/pull-requests.md, Release notes).');
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
