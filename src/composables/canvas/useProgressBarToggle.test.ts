import { describe, expect, it } from 'vitest'
import { useProgressBarToggle } from './useProgressBarToggle'

describe('useProgressBarToggle', () => {
  it('starts from the kept choice and keeps each flip', () => {
    const saved: boolean[] = []
    const { showProgressBar, toggleProgressBar } = useProgressBarToggle({ load: () => true, save: (on) => void saved.push(on) })
    expect(showProgressBar.value).toBe(true)
    toggleProgressBar()
    expect(showProgressBar.value).toBe(false)
    toggleProgressBar()
    expect(saved).toEqual([false, true])
  })
})
