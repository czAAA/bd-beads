import type { ComponentInternalInstance } from 'vue'

/** Components that are only a Tooltip around a button: the Tooltip they show belongs to whoever uses them too. */
const WRAPPERS = ['IconButton']

/** The instance whose template wrote this component's tag (Vue's own bookkeeping, not part of its public types). */
const writer = (instance: ComponentInternalInstance): ComponentInternalInstance | null => (instance.vnode as unknown as { ctx: ComponentInternalInstance | null }).ctx

const nameOf = (instance: ComponentInternalInstance): string => instance.type.__name ?? ''

/**
 * Which components' templates a Tooltip comes from, as names separated by spaces (ticket 264): the one that wrote the
 * `<AppTooltip>` tag and, when that one is just a wrapper (an IconButton), the one that wrote the wrapper's tag. The
 * hover text check reads it off the bubble to know which places in the source it has seen open.
 */
export function tooltipOwners(self: ComponentInternalInstance | null): string {
  const names: string[] = []
  for (let owner = self && writer(self); owner; owner = writer(owner)) {
    names.push(nameOf(owner))
    if (!WRAPPERS.includes(nameOf(owner))) break
  }
  return names.join(' ')
}
