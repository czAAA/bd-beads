// Mutation testing, run by hand and never in CI (ticket 0599, docs/testing.md): it proves a cut in the tests lost nothing.
// Name the code under test on the command line: `npm run mutate -- --mutate src/domain/frame.ts,src/domain/changeFrame.ts`.
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vite.config.ts', related: true },
  coverageAnalysis: 'perTest',
  // A mutant in module-level code re-runs every related test: most of the time, for little to learn.
  ignoreStatic: true,
  // Two workers, as Vitest has: more exhausted a dev machine's memory (vite.config.ts).
  concurrency: 2,
  reporters: ['clear-text', 'progress', 'json', 'html'],
  // `reports/` is a link into the docs repo, so the reports go to a folder of their own.
  jsonReporter: { fileName: '.stryker/mutation.json' },
  htmlReporter: { fileName: '.stryker/mutation.html' },
  tempDirName: '.stryker/tmp',
  // The docs repo's links (scripts/link-docs.sh) can't be copied into the sandbox, and no test reads them.
  ignorePatterns: ['/.scratch', '/docs/adr', '/docs/research', '/docs/specs', '/docs/operations.md', '/reports', '/research_notes',
    '/dist', '/test-results', '/.wrangler'],
  incremental: false,
  cleanTempDir: 'always',
}
