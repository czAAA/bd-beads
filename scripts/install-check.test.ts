// Ticket 1205: the part of the browser check that needs no browser. The check itself is run against a build and a host
// (docs/deploy.md), never in the unit suite.
import { describe, expect, it } from 'vitest';
import { cacheNameOf } from './install-check.ts';

describe('cacheNameOf', () => {
  it("reads the cache name a built worker opens, as `renderServiceWorker` writes it", () => {
    expect(cacheNameOf('// x\nconst CACHE = "bd-beads-3ab5dd08df70"\nconst PRECACHE = []\n')).toBe('bd-beads-3ab5dd08df70');
  });

  it('refuses a worker with no cache name, so a check can never pass against nothing', () => {
    expect(() => cacheNameOf('const PRECACHE = []\n')).toThrow();
    expect(() => cacheNameOf("const CACHE = '__CACHE_NAME__'\n")).toThrow();
  });
});
