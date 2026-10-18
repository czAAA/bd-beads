import type { ComponentInternalInstance } from 'vue'

/** Components that are only a Tooltip around a button: the Tooltip they show belongs to whoever uses them too. */
const WRAPPERS = ['IconButton']

/** The instance whose template wrote this component's tag (Vue's own bookkeeping, not part of its public types). */
const writer = (instance: ComponentInternalInstance): ComponentInternalInstance | null => (instance.vnode as unknown as { ctx: ComponentInternalInstance | null }).ctx

const nameOf = (instance: ComponentInternalInstance): string => instance.type.__name ?? ''

/** Names, space-separated, of the components whose templates a Tooltip comes from (ticket 264): the `<AppTooltip>`
 * writer and, if it is a wrapper, the wrapper's writer. */
export function tooltipOwners(self: ComponentInternalInstance | null): string {
  const names: string[] = []
  for (let owner = self && writer(self); owner; owner = writer(owner)) {
    names.push(nameOf(owner))
    if (!WRAPPERS.includes(nameOf(owner))) break
  }
  return names.join(' ')
}
