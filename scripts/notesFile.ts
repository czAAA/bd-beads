// The notes files (ticket 1047, spec 1043): one per language, which the build writes beside the app and the dev server
// serves, so the app's script carries no note. What's new reads the file of the language shown; its shape and reader
// are the app's (src/domain/notesFile.ts).
import { newerFirst, type NotesFile, type NotesFileNote } from '../src/domain/notesFile.ts';
import type { NoteFiles } from './notes.ts';
import type { NumberedNote, Release } from './versions.ts';

/** The notes file in `locale`: the Build's Version, the last two releases, and every note numbered above the older of
 * the two (the record's and those since), newest first. A note with no line in `locale` takes its English one. */
export function notesFile(files: NoteFiles, unreleased: readonly NumberedNote[], build: string, locale: string): NotesFile {
  const releases: Release[] = files.record.slice(-2);
  const oldest = releases[0]?.version ?? '0.0.0';
  const byName = new Map(files.notes.map((note) => [note.name, note]));
  const notes: NotesFileNote[] = [...files.record.flatMap((release) => release.notes), ...unreleased]
    .filter((note) => newerFirst(note.version, oldest) < 0)
    .map((note) => {
      const file = byName.get(note.name);
      if (!file) throw new Error(`${note.name} is in the release record but its file is gone`);
      return { name: note.name, version: note.version, date: file.date, kind: note.kind, line: file.lines[locale] ?? file.line };
    })
    .sort((a, b) => newerFirst(a.version, b.version) || b.name.localeCompare(a.name));
  return { version: build, releases: releases.map(({ version, date }) => ({ version, date })), notes };
}
