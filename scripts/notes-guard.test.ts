// The CI check that a branch keeps every Release note on `main` (ticket 1045, spec 1043), on throwaway git repos.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTES_DIR } from './noteOrder.ts';
import { notesGuard } from './notes-guard.ts';

const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo: string;

function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function commit(files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'change');
}

const note = (path: string, kind?: string) => ({ [`${NOTES_DIR}/${path}.json`]: JSON.stringify({ date: '2026-11-18', ...(kind && { kind }), line: { en: 'A line' } }) });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'notes-guard-'));
  git('init', '-q', '-b', 'main');
  commit({ ...note('2026-11-18-0001', 'new'), ...note('before-1.0.0/2026-11-01-0002') });
  git('checkout', '-q', '-b', 'branch');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('notesGuard', () => {
  it('passes a branch that adds a note and corrects another’s wording', () => {
    commit({ ...note('2026-11-19-0003', 'fixed'), [`${NOTES_DIR}/2026-11-18-0001.json`]: JSON.stringify({ date: '2026-11-18', kind: 'new', line: { en: 'Better' } }) });
    expect(notesGuard(repo, 'main', 'HEAD')).toEqual([]);
  });

  it('refuses a note on main that is missing, renamed or changed in kind on the branch', () => {
    renameSync(join(repo, NOTES_DIR, 'before-1.0.0/2026-11-01-0002.json'), join(repo, NOTES_DIR, 'before-1.0.0/2026-11-01-0009.json'));
    commit(note('2026-11-18-0001', 'changed'));
    expect(notesGuard(repo, 'main', 'HEAD')).toEqual([
      '2026-11-18-0001 is new on main but changed here',
      '2026-11-01-0002 is on main but missing here',
    ]);
  });

  it('lets a note from before 1.0.0 move between the folders', () => {
    renameSync(join(repo, NOTES_DIR, 'before-1.0.0/2026-11-01-0002.json'), join(repo, NOTES_DIR, '2026-11-01-0002.json'));
    commit({});
    expect(notesGuard(repo, 'main', 'HEAD')).toEqual([]);
  });
});
