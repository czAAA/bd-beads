import { nextTick } from 'vue'
import { describe, expect, it } from 'vitest'
import { useA11yAnnouncer } from './useA11yAnnouncer'

describe('useA11yAnnouncer', () => {
  it('says the announced text on the next tick, clearing it first', async () => {
    const { announcement, announce } = useA11yAnnouncer()
    announce('one')
    expect(announcement.value).toBe('')
    await nextTick()
    expect(announcement.value).toBe('one')
  })

  it('says the same words twice by clearing between them', async () => {
    const { announcement, announce } = useA11yAnnouncer()
    announce('again')
    await nextTick()
    announce('again')
    expect(announcement.value).toBe('')
    await nextTick()
    expect(announcement.value).toBe('again')
  })
})
