import { BaseSequencer, type TestSpecification } from 'vitest/node'

// The order a worker takes its test files in. Vitest starts the files it has no timings for largest first, and CI keeps
// none, so a short file that plays for minutes (What's inside's whole tour) started last, after every other file of its
// shard, and the shard took both. Started first, it plays while the other worker runs the rest.

/** A test file that takes minutes, named so to start first. */
const LONG_TESTS = /\.long\.(browser\.)?test\.ts$/

/** `files` in the order given, each project's long files moved to its front; the projects keep their order. */
export function longFilesFirst<File extends { moduleId: string; project: { name: string } }>(files: readonly File[]): File[] {
  const projects = new Map<string, File[]>()
  for (const file of files) projects.set(file.project.name, [...(projects.get(file.project.name) ?? []), file])
  return [...projects.values()].flatMap((own) => [...own.filter(isLong), ...own.filter((file) => !isLong(file))])
}

function isLong(file: { moduleId: string }): boolean {
  return LONG_TESTS.test(file.moduleId)
}

/** Vitest's own order, then each project's long files first. */
export class LongFilesFirst extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    return longFilesFirst(await super.sort(files))
  }
}
