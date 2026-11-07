import { fillBlanks } from '../domain/fillBlanks'
import type { Translations } from '../i18n/translations'
import type { IconName } from '../components/ui/icons'
import { controlAction } from '../composables/shell/controlRegistry'

// The coffee screen's words (Homepage card, ticket 0823): its six promises, each with its icon, and the Say hello tile's
// line. The Menu's labels they point at come from the app, never typed into the copy.

/** One promise as shown: its icon, its name, and its line for screen readers. */
export interface CoffeePromise {
  id: keyof Translations['homepage']['promises']
  icon: IconName
  name: string
  text: string
}

const PROMISES = [
  { id: 'device', icon: 'device' },
  { id: 'offline', icon: 'cloud-off' },
  { id: 'noAds', icon: 'close' },
  { id: 'pencil', icon: 'pen-mode' },
  { id: 'free', icon: 'check' },
  { id: 'shortcuts', icon: 'keyboard' },
] as const satisfies readonly { id: CoffeePromise['id']; icon: IconName }[]

/** The six promises in a language, in the order the band shows them. */
export function coffeePromises(t: Translations): CoffeePromise[] {
  const blanks = { menu: controlAction('strip-menu').name(t), help: t.panels.menu.help, shortcuts: t.shortcutsHelp.title }
  return PROMISES.map(({ id, icon }) => {
    const copy = t.homepage.promises[id]
    return { id, icon, name: copy.name, text: id === 'shortcuts' ? fillBlanks(copy.text, blanks) : copy.text }
  })
}

/** Say hello's line, pointing at the Menu's own Send feedback row. */
export function sayHelloText(t: Translations): string {
  return fillBlanks(t.homepage.sayHello.text, { menu: controlAction('strip-menu').name(t), feedback: t.panels.menu.sendFeedback })
}
