// The Release notes and the release record as files (ticket 1046, spec 1043, ADR 0096), read once for the Build's
// Version (vite.version.ts), the changelog (scripts/changelog.ts) and the release command (scripts/make-release.ts).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NOTES_DIR, noteOrder } from './noteOrder.ts';
import { RELEASE_RECORD } from './release.ts';
import { numberNotes, type Kind, type NumberedNote, type Release } from './versions.ts';

/** One note's file: its name (day and ticket), its day, its kind (none before 1.0.0), its English line and its line in
 * every language, by locale. */
export interface NoteFile {
  name: string;
  date: string;
  kind?: Kind;
  line: string;
  lines: Record<string, string>;
}

/** What the repo holds: the release record, the notes since 1.0.0 and the notes from before it, each by file name. */
export interface NoteFiles {
  record: Release[];
  notes: NoteFile[];
  before: NoteFile[];
}

function readFolder(folder: string): NoteFile[] {
  if (!existsSync(folder)) return [];
  return readdirSync(folder)
    .filter((file) => file.endsWith('.json'))
    .sort()
    .map((file) => {
      const note = JSON.parse(readFileSync(resolve(folder, file), 'utf8')) as { date: string; kind?: Kind; line?: Record<string, string> };
      return { name: file.slice(0, -'.json'.length), date: note.date, kind: note.kind, line: note.line?.en ?? '', lines: note.line ?? {} };
    });
}

/** The record and every note file in `root`, with no git. */
export function readNoteFiles(root: string): NoteFiles {
  return {
    record: JSON.parse(readFileSync(resolve(root, RELEASE_RECORD), 'utf8')) as Release[],
    notes: readFolder(resolve(root, NOTES_DIR)),
    before: readFolder(resolve(root, NOTES_DIR, 'before-1.0.0')),
  };
}

/** The notes the record doesn't list, numbered in the order they merged on `ref`'s line, and the Build's Version. Null
 * when git can't be read and `strict` (a build that ships, a release); elsewhere a note git can't place goes last, by
 * file name, as does one not yet committed. */
export function numberUnreleased(root: string, files: NoteFiles, strict: boolean, ref = 'HEAD'): { notes: NumberedNote[]; build: string } | null {
  const recorded = files.record.flatMap((release) => release.notes);
  const released = new Set(recorded.map((note) => note.name));
  const unreleased = files.notes.filter((note) => !released.has(note.name));
  const order = unreleased.length > 0 || strict ? noteOrder(root, unreleased.map((note) => note.name), files.record.at(-1)?.version, ref) : { placed: [], beforeRelease: 0 };
  if (!order && strict) return null;
  const placed = order?.placed ?? [];
  const last = unreleased.map((note) => note.name).filter((name) => !placed.includes(name));
  const kinds = new Map(unreleased.map((note) => [note.name, note.kind as Kind]));
  const { notes, build } = numberNotes(files.record, [...placed, ...last].map((name) => ({ name, kind: kinds.get(name) as Kind })), order?.beforeRelease ?? 0);
  return { notes: notes.slice(recorded.length), build };
}
