// The deploy's two checks of the worker's file list (ticket 1204): the build holds each file, and the host serves each.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { missingFromBuild, notServed } from './precache-guard.ts';

let dist: string;

function build(listed: string[], present: string[]): void {
  writeFileSync(join(dist, 'sw.js'), `const CACHE = "bd-beads-1"\nconst PRECACHE = ${JSON.stringify(listed)}\n`);
  for (const path of present) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), 'x');
  }
}

/** A host that answers 200 for `served` and 404 for the rest, and records what it was asked. */
function host(served: (url: string, asked: number) => boolean) {
  const asked: { url: string; headers: Record<string, string> }[] = [];
  const count = new Map<string, number>();
  const ask = (url: string, init: { headers: Record<string, string> }) => {
    asked.push({ url, headers: init.headers });
    count.set(url, (count.get(url) ?? 0) + 1);
    return Promise.resolve({ status: served(url, count.get(url)!) ? 200 : 404 });
  };
  return { ask, asked };
}

const noWait = () => Promise.resolve();

beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'precache-guard-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

describe('missingFromBuild', () => {
  it('finds nothing when the build holds every listed file', () => {
    build(['index.html', 'assets/app.js'], ['index.html', 'assets/app.js']);
    expect(missingFromBuild(dist)).toEqual([]);
  });

  it('names a listed file the build lacks, such as a dot folder an artifact left out', () => {
    build(['.well-known/security.txt', 'index.html'], ['index.html']);
    expect(missingFromBuild(dist)).toEqual(['.well-known/security.txt']);
  });

  it('refuses a worker with no list, or an empty one', () => {
    writeFileSync(join(dist, 'sw.js'), 'const CACHE = "bd-beads-1"\n');
    expect(() => missingFromBuild(dist)).toThrow();
    build([], []);
    expect(() => missingFromBuild(dist)).toThrow();
  });
});

describe('notServed', () => {
  it('asks the host for every listed file, with the headers given, and finds nothing when each answers 200', async () => {
    build(['index.html', 'assets/app.js'], []);
    const { ask, asked } = host(() => true);
    expect(await notServed(dist, 'https://host.example/', { 'X-Token': 't' }, ask, noWait)).toEqual([]);
    expect(asked).toEqual([
      { url: 'https://host.example/index.html', headers: { 'X-Token': 't' } },
      { url: 'https://host.example/assets/app.js', headers: { 'X-Token': 't' } },
    ]);
  });

  it('names a file the host does not answer 200 for, with its answer', async () => {
    build(['.well-known/security.txt', 'index.html'], []);
    const { ask } = host((url) => url.endsWith('index.html'));
    expect(await notServed(dist, 'https://host.example', {}, ask, noWait)).toEqual(['.well-known/security.txt: 404']);
  });

  it('asks again for a file a location did not have yet, and passes once it is there', async () => {
    build(['index.html'], []);
    const { ask, asked } = host((_url, time) => time >= 3);
    expect(await notServed(dist, 'https://host.example', {}, ask, noWait)).toEqual([]);
    expect(asked).toHaveLength(3);
  });

  it('asks for a name with a space or a hash as one path', async () => {
    build(['fonts/a b#c.woff2'], []);
    const { ask, asked } = host(() => true);
    await notServed(dist, 'https://host.example', {}, ask, noWait);
    expect(asked[0].url).toBe('https://host.example/fonts/a%20b%23c.woff2');
  });

  it('names a file the host could not be asked for', async () => {
    build(['index.html'], []);
    const ask = () => Promise.reject(new Error('timed out'));
    expect(await notServed(dist, 'https://host.example', {}, ask, noWait)).toEqual(['index.html: timed out']);
  });
});
