// The notes files (ticket 1047, spec 1043): one per language, `notes/<locale>.json` beside the app, written by the
// build and served by the dev server, so the app's script carries no note and the Offline copy holds all seven.
import type { Plugin } from 'vite';
import { notesFile } from './scripts/notesFile.ts';
import { numberUnreleased, readNoteFiles } from './scripts/notes.ts';
import { LOCALES } from './src/domain/locale.ts';
import { notesFilePath } from './src/domain/notesFile.ts';

/** Every language's notes file as text, by its path from the app's base, from the release record and the note files in
 * `root`. A build that `ships` needs git to place a note (spec 1043); elsewhere such a note goes last. */
function notesFileTexts(root: string, ships: boolean): Map<string, string> {
  const files = readNoteFiles(root);
  const numbered = numberUnreleased(root, files, ships);
  if (!numbered) throw new Error('The notes files can’t be written without git’s whole history (spec 1043).');
  return new Map(LOCALES.map((locale) => [notesFilePath(locale), `${JSON.stringify(notesFile(files, numbered.notes, numbered.build, locale))}\n`]));
}

/** Writes the notes files into the build, and serves them fresh on each request from the dev server. */
export function releaseNotesFiles(): Plugin {
  let root = '';
  let base = '/';
  return {
    name: 'openbeads-notes-files',
    configResolved(config) {
      root = config.root;
      base = config.base;
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const path = request.url?.split('?')[0] ?? '';
        if (!path.startsWith(`${base}notes/`)) return next();
        const text = notesFileTexts(root, false).get(path.slice(base.length));
        if (text === undefined) return next();
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.end(text);
      });
    },
    generateBundle() {
      // Not inside the unit tests' builds (vite.pwa.test.ts), which may run where git can't place a note.
      for (const [fileName, source] of notesFileTexts(root, !process.env.VITEST)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
