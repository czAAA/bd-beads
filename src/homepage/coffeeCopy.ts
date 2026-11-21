import { fillBlanks } from '../domain/fillBlanks'
import type { Translations } from '../i18n/translations'
import type { IconName } from '../components/ui/icons'
import { controlAction } from '../composables/shell/controlRegistry'

// The coffee screen's words (Homepage card, tickets 0823, 0880, 0948, 1175): its seven promises, each with its icon and
// its row, then Open source and Say hello, the two that act. The Menu's labels they point at come from the app, never typed into the copy.

/** The row a promise stands in: what openbeads is, then how you use it (ticket 1175). */
type PromiseRow = 'what' | 'how'

/** One promise as shown: its icon, its row, its name, and its line for screen readers. */
interface CoffeePromise {
  id: keyof Translations['homepage']['promises']
  icon: IconName
  row: PromiseRow
  name: string
  text: string
}

const PROMISES = [
  { id: 'device', icon: 'device', row: 'what' },
  { id: 'offline', icon: 'cloud-off', row: 'what' },
  { id: 'noAds', icon: 'eye-off', row: 'what' },
  { id: 'free', icon: 'check', row: 'what' },
  { id: 'tablets', icon: 'pen-mode', row: 'how' },
  { id: 'mouse', icon: 'mouse', row: 'how' },
  { id: 'shortcuts', icon: 'keyboard', row: 'how' },
] as const satisfies readonly Pick<CoffeePromise, 'id' | 'icon' | 'row'>[]

/** The seven promises in a language, in the order the band shows them. */
export function coffeePromises(t: Translations): CoffeePromise[] {
  const blanks = { menu: controlAction('strip-menu').name(t), help: t.panels.menu.help, shortcuts: t.shortcutsHelp.title }
  return PROMISES.map(({ id, icon, row }) => {
    const copy = t.homepage.promises[id]
    return { id, icon, row, name: copy.name, text: id === 'shortcuts' ? fillBlanks(copy.text, blanks) : copy.text }
  })
}

/** Open source or Say hello, the two that act: its icon, its name, and its line for screen readers. */
interface CoffeeAct {
  id: 'openSource' | 'sayHello'
  icon: IconName
  name: string
  text: string
}

/** Open source and Say hello in a language, in the band's order. */
export function coffeeActs(t: Translations): CoffeeAct[] {
  const sayHello = fillBlanks(t.homepage.sayHello.text, { menu: controlAction('strip-menu').name(t), feedback: t.panels.menu.sendFeedback })
  return [
    { id: 'openSource', icon: 'code', name: t.homepage.openSource.name, text: t.homepage.openSource.text },
    { id: 'sayHello', icon: 'message', name: t.homepage.sayHello.name, text: sayHello },
  ]
}

/** A phone's rows in a language: the seven promises, then Open source and Say hello. */
export function coffeeRows(t: Translations): (CoffeePromise | CoffeeAct)[] {
  return [...coffeePromises(t), ...coffeeActs(t)]
}
