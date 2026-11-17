// What the build tells the app about itself (ticket 1045, spec 1043, ADR 0096): its Version, its build mark (the short
// commit hash) and the date of its newest note or release. The package file's version is not read.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NOTES_DIR, noteOrder } from './scripts/noteOrder.ts';
import { RELEASE_RECORD } from './scripts/release.ts';
import { numberNotes, type Kind, type Release } from './scripts/versions.ts';

export interface BuildVersion {
  version: string;
  /** The commit's hash, seven characters; `dev` outside git. */
  mark: string;
  /** The day of the newest note or release, `YYYY-MM-DD`. */
  date: string;
}

/** The Build's Version from the release record and the note files in `root`. A note git can't place (no git, a shallow
 * checkout) fails a build that `ships`; elsewhere (the dev server, the unit tests) it goes last, by file name, as does
 * one not yet committed. */
export function buildVersion(root: string, ships: boolean): BuildVersion {
  const record = JSON.parse(readFileSync(resolve(root, RELEASE_RECORD), 'utf8')) as Release[];
  const released = new Set(record.flatMap((release) => release.notes.map((note) => note.name)));
  const notes = readdirSync(resolve(root, NOTES_DIR))
    .filter((file) => file.endsWith('.json'))
    .map((file) => ({ name: file.slice(0, -'.json'.length), ...(JSON.parse(readFileSync(resolve(root, NOTES_DIR, file), 'utf8')) as { date: string; kind: Kind }) }))
    .filter((note) => !released.has(note.name));
  const newest = record.at(-1)?.version;
  const order = notes.length > 0 || ships ? noteOrder(root, notes.map((note) => note.name), newest) : { placed: [], beforeRelease: 0 };
  if (!order && ships) {
    throw new Error(`The Version can't be worked out without git's whole history: fetch it (\`git fetch --unshallow\`, or \`fetch-depth: 0\` in CI) and build again (spec 1043).`);
  }
  const placed = order?.placed ?? [];
  const last = notes.map((note) => note.name).filter((name) => !placed.includes(name)).sort();
  const kinds = new Map(notes.map((note) => [note.name, note.kind]));
  const { build } = numberNotes(record, [...placed, ...last].map((name) => ({ name, kind: kinds.get(name) as Kind })), order?.beforeRelease ?? 0);
  const date = [...notes.map((note) => note.date), ...record.map((release) => release.date)].sort().at(-1) ?? '';
  return { version: build, mark: commitMark(root, ships), date };
}

function commitMark(root: string, ships: boolean): string {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim().slice(0, 7);
  } catch (error) {
    if (ships) throw error;
    return 'dev';
  }
}
