// The release command (ticket 1046, spec 1043, ADR 0096), `npm run release` when the owner says "release": adds the
// next Production release with the number and kind of every unreleased note, and writes CHANGELOG.md. The steps
// around it are in docs/agents/pull-requests.md (The release PR).
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CHANGELOG, changelog } from './changelog.ts';
import { NOTES_DIR } from './noteOrder.ts';
import { numberUnreleased, readNoteFiles } from './notes.ts';
import { git, RELEASE_RECORD } from './release.ts';
import { nextRelease, type Release } from './versions.ts';

const inline = (fields: object): string =>
  `{ ${Object.entries(fields).map(([key, value]) => `${JSON.stringify(key)}: ${JSON.stringify(value)}`).join(', ')} }`;

/** The record as committed: a release per line, and a released note per line under it, so a release's diff reads. */
function formatRecord(record: readonly Release[]): string {
  const release = ({ version, date, notes }: Release): string =>
    notes.length === 0
      ? `  ${inline({ version, date, notes })}`
      : [`  { "version": ${JSON.stringify(version)}, "date": ${JSON.stringify(date)}, "notes": [`, notes.map((note) => `    ${inline(note)}`).join(',\n'), '  ] }'].join('\n');
  return `[\n${record.map(release).join(',\n')}\n]\n`;
}

/** The note files at `ref`, by name: the ones since 1.0.0, not the ones in `before-1.0.0/`. */
function notesAt(root: string, ref: string): Set<string> {
  const paths = git(root, ['ls-tree', '--name-only', `${ref}:${NOTES_DIR}`]).split('\n');
  return new Set(paths.filter((path) => path.endsWith('.json')).map((path) => path.slice(0, -'.json'.length)));
}

/** Adds release X.0.0 dated `today` with every note `base` holds that no release lists, numbered in the order they
 * merged there, and writes CHANGELOG.md. Run again on the release branch, it makes that release again with the notes
 * merged meanwhile. Throws, writing nothing, when no note is unreleased or the branch is behind `base`. */
export function makeRelease(root: string, base: string, today: string): { version: string; notes: number } {
  const files = readNoteFiles(root);
  const onBase = JSON.parse(git(root, ['show', `${base}:${RELEASE_RECORD}`])) as Release[];
  const baseVersions = new Set(onBase.map((release) => release.version));
  const newest = files.record.at(-1);
  const ours = newest !== undefined && !baseVersions.has(newest.version);
  const record = ours ? files.record.slice(0, -1) : files.record;
  const here = new Set(files.notes.map((note) => note.name));
  const there = notesAt(root, base);
  const sameNotes = here.size === there.size && [...here].every((name) => there.has(name));
  if (JSON.stringify(record) !== JSON.stringify(onBase) || !sameNotes) {
    throw new Error(`The release record or the Release notes here differ from ${base}'s: merge ${base} in (\`git merge ${base}\`) and run again.`);
  }
  const numbered = numberUnreleased(root, { ...files, record }, true, base);
  if (!numbered) throw new Error('A release needs git\'s whole history: `git fetch --unshallow`, and run again.');
  if (numbered.notes.length === 0) throw new Error('No Release note is unreleased, so there is nothing to release.');
  const release = { version: nextRelease(record), date: today, notes: numbered.notes };
  const after = [...record, release];
  writeFileSync(resolve(root, RELEASE_RECORD), formatRecord(after));
  writeFileSync(resolve(root, CHANGELOG), changelog({ ...files, record: after }));
  return { version: release.version, notes: release.notes.length };
}

function main(args: string[]): void {
  try {
    if (args.length > 0 && (args.length !== 2 || args[0] !== '--base')) throw new Error('usage: node scripts/make-release.ts [--base <ref>]');
    const base = args[1] ?? 'origin/main';
    const { version, notes } = makeRelease(process.cwd(), base, new Date().toISOString().slice(0, 10));
    console.log(`Release ${version} holds ${notes} Release note(s); ${RELEASE_RECORD} and ${CHANGELOG} are written.`);
    console.log(`Commit both and open the pull request \`release: ${version}\` (docs/agents/pull-requests.md, The release PR).`);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
