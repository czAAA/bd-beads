import { describe, expect, it } from 'vitest'
import { longFilesFirst } from './vite.sequencer.ts'

// A file that plays for minutes starts first, so it plays beside the shard's other files instead of after them.

const file = (project: string, moduleId: string) => ({ project: { name: project }, moduleId })

describe('longFilesFirst', () => {
  it("moves each project's long files to its front, the rest in Vitest's order", () => {
    const files = [
      file('browser', 'src/a.browser.test.ts'),
      file('browser', 'src/tour.desk.long.browser.test.ts'),
      file('browser', 'src/b.browser.test.ts'),
      file('browser-touch', 'src/c.touch.browser.test.ts'),
      file('unit', 'src/d.test.ts'),
      file('unit', 'src/e.long.test.ts'),
    ]
    expect(longFilesFirst(files).map((each) => each.moduleId)).toEqual([
      'src/tour.desk.long.browser.test.ts',
      'src/a.browser.test.ts',
      'src/b.browser.test.ts',
      'src/c.touch.browser.test.ts',
      'src/e.long.test.ts',
      'src/d.test.ts',
    ])
  })

  it('leaves a file that only has "long" elsewhere in its name where it was', () => {
    const files = [file('browser', 'src/a.browser.test.ts'), file('browser', 'src/longest.browser.test.ts')]
    expect(longFilesFirst(files)).toEqual(files)
  })
})
