import { fillBlanks } from '../domain/fillBlanks'
import type { Translations } from '../i18n/translations'
import type { IconName } from '../components/ui/icons'
import { controlAction } from '../composables/shell/controlRegistry'

// The coffee screen's words (Homepage card, tickets 0823, 0880, 0948): its six promises, each with its icon, then Open
// source and Say hello, the two that act. The Menu's labels they point at come from the app, never typed into the copy.

/** One promise as shown: its icon, its name, and its line for screen readers. */
interface CoffeePromise {
  id: keyof Translations['homepage']['promises']
  icon: IconName
  name: string
  text: string
}

const PROMISES = [
  { id: 'device', icon: 'device' },
  { id: 'offline', icon: 'cloud-off' },
  { id: 'noAds', icon: 'eye-off' },
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

/** A phone's rows in a language: the six promises, then Open source and Say hello. */
export function coffeeRows(t: Translations): (CoffeePromise | CoffeeAct)[] {
  return [...coffeePromises(t), ...coffeeActs(t)]
}
