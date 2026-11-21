import { describe, expect, it } from 'vitest'
import { en } from '../i18n/en'
import { ru } from '../i18n/ru'
import { coffeeActs, coffeePromises, coffeeRows } from './coffeeCopy'

describe("The coffee screen's copy (ticket 0823)", () => {
  it('has the seven promises in order, each with its icon and its row: what it is, then how you use it (ticket 1175)', () => {
    expect(coffeePromises(en).map(({ icon, name, row }) => [icon, name, row])).toEqual([
      ['device', 'Yours, on this device', 'what'],
      ['cloud-off', 'Works offline', 'what'],
      ['eye-off', 'No ads or tracking', 'what'],
      ['check', 'Free forever', 'what'],
      ['pen-mode', 'For tablets and pens', 'how'],
      ['mouse', 'For computers and phones', 'how'],
      ['keyboard', 'Keyboard shortcuts', 'how'],
    ])
    expect(coffeePromises(en)[5].text).toBe(
      'With a mouse, right-click for tools and colors where you draw. The wheel scrolls, and with Ctrl or ⌘ it zooms. On a phone, hold the Canvas for them and pinch to zoom.',
    )
  })

  it('says Yours, on this device without "offline", which is a promise of its own', () => {
    expect(coffeePromises(en)[0].text).toBe('Runs in your browser. No account, nothing to install.')
  })

  it("points Keyboard shortcuts at the Menu path in the app's own labels, in every language", () => {
    expect(coffeePromises(en)[6].text).toBe('Every edit has its own key. Find them all in Menu → Help → Keyboard shortcuts.')
    expect(coffeePromises(ru)[6].text).toContain(`${ru.panels.menu.help} → ${ru.shortcutsHelp.title}`)
  })

  it('has the rows: the seven promises, then Open source and Say hello (tickets 0880, 0948)', () => {
    expect(coffeeRows(en).map(({ id }) => id)).toEqual(['device', 'offline', 'noAds', 'free', 'tablets', 'mouse', 'shortcuts', 'openSource', 'sayHello'])
    expect(coffeeActs(en).map(({ icon, name }) => [icon, name])).toEqual([
      ['code', 'Open source'],
      ['message', 'Say hello'],
    ])
  })

  it("points Say hello at the Menu's own Send feedback row", () => {
    const sayHello = (t: typeof en) => coffeeActs(t).find((act) => act.id === 'sayHello')!.text
    expect(sayHello(en)).toBe("A bug, an idea, a pattern you made: send it to the family. It's also in Menu → Send feedback.")
    expect(sayHello(ru)).toContain(`→ ${ru.panels.menu.sendFeedback}.`)
  })
})
