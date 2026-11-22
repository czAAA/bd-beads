import { describe, expect, it } from 'vitest'
import { en } from './en'
import { saveReminderMeta } from './saveReminderWords'

const DAY_MS = 24 * 60 * 60 * 1000

describe('saveReminderMeta (tickets 0796, 1192)', () => {
  it('says the count, then that there is no Project file yet', () => {
    expect(saveReminderMeta(en.saveReminder, 'en', { beads: 120 }, 0)).toEqual(['Beads since last file: 120', 'No Project file yet'])
  })

  it('says the count, then when the last file was saved', () => {
    expect(saveReminderMeta(en.saveReminder, 'en', { beads: 0, lastFileAt: 0 }, 2 * DAY_MS)).toEqual(['Beads since last file: 0', 'Last file: 2 days ago'])
  })
})
