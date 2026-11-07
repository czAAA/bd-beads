import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { coffeePromises, sayHelloText } from './coffeeCopy'

describe("The coffee screen's copy (ticket 0823)", () => {
  it('has the six promises in order, each with its icon', () => {
    expect(coffeePromises(en).map(({ icon, name }) => [icon, name])).toEqual([
      ['device', 'Yours, on this device'],
      ['cloud-off', 'Works offline'],
      ['close', 'No ads or tracking'],
      ['pen-mode', 'For iPad and Pencil'],
      ['check', 'Free forever'],
      ['keyboard', 'Keyboard shortcuts'],
    ])
  })

  it('says Yours, on this device without "offline", which is a promise of its own', () => {
    expect(coffeePromises(en)[0].text).toBe('Runs in your browser. No account, nothing to install.')
  })

  it("points Keyboard shortcuts at the Menu path in the app's own labels, in every language", () => {
    expect(coffeePromises(en)[5].text).toBe('Every edit has its own key. Find them all in Menu → Help → Keyboard shortcuts.')
    expect(coffeePromises(ru)[5].text).toContain(`${ru.panels.menu.help} → ${ru.shortcutsHelp.title}`)
  })

  it("points Say hello at the Menu's own Send feedback row", () => {
    expect(sayHelloText(en)).toBe("A bug, an idea, a pattern you made: send it to the family. It's also in Menu → Send feedback.")
    expect(sayHelloText(ru)).toContain(`→ ${ru.panels.menu.sendFeedback}.`)
  })
})
