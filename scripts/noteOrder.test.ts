// Merge order from git (ticket 1045, spec 1043), on throwaway git repos: each test builds the `main` it needs.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { NOTES_DIR, noteOrder } from './noteOrder.ts';
import { RELEASE_RECORD } from './release.ts';

// The machine's own git config (signing, hooks, a default branch) stays out of the throwaway repos.
const GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

let repo: string;

function git(...args: string[]): string {
  return execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', ...args], { cwd: repo, env: GIT_ENV, encoding: 'utf8' }).trim();
}

function write(files: Record<string, string>): void {
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
  }
}

function commit(files: Record<string, string>): void {
  write(files);
  git('add', '-A');
  git('commit', '-q', '--allow-empty', '-m', 'change');
}

const note = (...names: string[]) => Object.fromEntries(names.map((name) => [`${NOTES_DIR}/${name}.json`, '{"kind":"fixed"}']));
const record = (...versions: string[]) => ({ [RELEASE_RECORD]: JSON.stringify(versions.map((version) => ({ version, date: '2026-11-18', notes: [] }))) });

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), 'note-order-'));
  git('init', '-q', '-b', 'main');
});

afterEach(() => rmSync(repo, { recursive: true, force: true }));

describe('noteOrder', () => {
  it('lists the notes in the order their commits sit on main, two in one commit by file name', () => {
    commit(note('2026-11-18-0009'));
    commit(note('2026-11-18-0005', '2026-11-18-0003'));
    commit(note('2026-11-17-0001'));
    const names = ['2026-11-17-0001', '2026-11-18-0003', '2026-11-18-0005', '2026-11-18-0009'];

    expect(noteOrder(repo, names, undefined)).toEqual({ placed: ['2026-11-18-0009', '2026-11-18-0003', '2026-11-18-0005', '2026-11-17-0001'], beforeRelease: 0 });
  });

  it('editing a note’s wording moves nothing', () => {
    commit(note('2026-11-18-0001'));
    commit(note('2026-11-18-0002'));
    commit({ [`${NOTES_DIR}/2026-11-18-0001.json`]: '{"kind":"fixed","line":{}}' });

    expect(noteOrder(repo, ['2026-11-18-0001', '2026-11-18-0002'], undefined)?.placed).toEqual(['2026-11-18-0001', '2026-11-18-0002']);
  });

  it('counts the notes that merged before the newest release’s commit', () => {
    commit(record('1.0.0'));
    commit(note('2026-11-18-0001'));
    commit(note('2026-11-18-0002'));
    commit(record('1.0.0', '2.0.0'));
    commit(note('2026-11-19-0003'));

    expect(noteOrder(repo, ['2026-11-18-0002', '2026-11-19-0003'], '2.0.0')).toEqual({ placed: ['2026-11-18-0002', '2026-11-19-0003'], beforeRelease: 1 });
  });

  it('counts every committed note before a release not yet committed', () => {
    commit(note('2026-11-18-0001'));
    write(record('1.0.0'));

    expect(noteOrder(repo, ['2026-11-18-0001'], '1.0.0')?.beforeRelease).toBe(1);
  });

  it('leaves out a note not yet committed, and one whose file was added somewhere else before', () => {
    commit({ [`${NOTES_DIR}/2026-11-01-0001.json`]: '{}' });
    renameSync(join(repo, NOTES_DIR, '2026-11-01-0001.json'), join(repo, NOTES_DIR, 'other.json'));
    git('add', '-A');
    git('commit', '-q', '-m', 'moved');
    write(note('2026-11-18-0002'));

    expect(noteOrder(repo, ['2026-11-18-0002'], undefined)?.placed).toEqual([]);
  });

  it('places nothing in a shallow checkout or outside git', () => {
    commit(note('2026-11-18-0001'));
    commit(note('2026-11-18-0002'));
    const shallow = mkdtempSync(join(tmpdir(), 'note-order-shallow-'));
    try {
      execFileSync('git', ['clone', '-q', '--depth=1', `file://${repo}`, shallow], { env: GIT_ENV });
      expect(noteOrder(shallow, ['2026-11-18-0001'], undefined)).toBeNull();
    } finally {
      rmSync(shallow, { recursive: true, force: true });
    }
    rmSync(join(repo, '.git'), { recursive: true, force: true });
    expect(noteOrder(repo, ['2026-11-18-0001'], undefined)).toBeNull();
  });
});
