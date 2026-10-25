import { describe, expect, it } from 'vitest'
import { unexplainedFit, type FitPending } from './fitPending'

const pending: FitPending[] = [{ case: 'Box', texts: ['Long words'], at: { ru: [320] }, fixedBy: '999' }]
const wraps = 'wraps h3.name "Long words" by 1px (2 lines, at most 1)'

describe('unexplainedFit', () => {
  it('lets a misfit through that an entry names, at the language and width it names', () => {
    expect(unexplainedFit('Box', 'ru', 320, [wraps], pending)).toEqual([])
  })

  it('reports a misfit no entry names: another width, language or case', () => {
    expect(unexplainedFit('Box', 'ru', 390, [wraps], pending)).toEqual([wraps])
    expect(unexplainedFit('Box', 'uk', 320, [wraps], pending)).toEqual([wraps])
    expect(unexplainedFit('Other', 'ru', 320, [wraps], pending)).toEqual([wraps])
  })

  it('reports an entry that matches nothing any more, so that a fix removes it', () => {
    const [problem] = unexplainedFit('Box', 'ru', 320, [], pending)
    expect(problem).toContain('no longer misfits')
    expect(problem).toContain('999')
  })

  it('does not report a borderline entry that matches nothing, but still lets its misfit through', () => {
    const borderline: FitPending[] = [{ ...pending[0], borderline: true }]
    expect(unexplainedFit('Box', 'ru', 320, [], borderline)).toEqual([])
    expect(unexplainedFit('Box', 'ru', 320, [wraps], borderline)).toEqual([])
  })
})
