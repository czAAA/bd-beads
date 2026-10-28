import { computed, shallowRef, type Ref, type WritableComputedRef } from 'vue'

/** Every dialog the shell can show over the app, one per question a flow asks (AppDialogs draws them). */
type DialogId =
  | 'delete-all'
  | 'reset-progress'
  | 'remove-frame'
  | 'remove-line'
  | 'replace-frame'
  | 'remove-color'
  | 'remove-all-colors'
  | 'replace-bead'
  | 'import-switch'
  | 'remove-project'
  | 'switch-project'
  | 'keep-note'
  | 'shortcuts'
  | 'duplicate-project'
  | 'delete-project'
  | 'delete-all-projects'
  | 'name-piece'

interface Asked {
  id: DialogId
  value: unknown
}

/** The dialog registry: which dialog shows, and what each pending one asks about. */
export interface Dialogs {
  /** The dialog showing, or none: the one value the shell keeps for every dialog (ticket 0618). */
  open: Readonly<Ref<DialogId | undefined>>
  /** What the dialog `id` asks about, as its flow holds it: set to ask, `undefined` to close. One flow owns each id. */
  question: <T>(id: DialogId) => WritableComputedRef<T | undefined>
  /** The same for a dialog that asks about nothing: true while it is asked. */
  flag: (id: DialogId) => WritableComputedRef<boolean>
}

/** Opens and closes the app's dialogs (ticket 0618): one shows at a time, and one asked while another shows waits
 * behind it, still pending for its flow, so a question that lands at the same moment (the keep note after a save) is
 * neither drawn over the other nor lost. */
export function useDialogs(): Dialogs {
  const asked = shallowRef<readonly Asked[]>([])

  const find = (id: DialogId) => asked.value.find((each) => each.id === id)

  function ask(id: DialogId, value: unknown) {
    asked.value = find(id) ? asked.value.map((each) => (each.id === id ? { id, value } : each)) : [...asked.value, { id, value }]
  }

  function close(id: DialogId) {
    if (find(id)) asked.value = asked.value.filter((each) => each.id !== id)
  }

  function question<T>(id: DialogId) {
    return computed<T | undefined>({
      get: () => find(id)?.value as T | undefined,
      set: (value) => (value === undefined ? close(id) : ask(id, value)),
    })
  }

  function flag(id: DialogId) {
    return computed<boolean>({
      get: () => find(id) !== undefined,
      set: (on) => (on ? ask(id, true) : close(id)),
    })
  }

  return { open: computed(() => asked.value[0]?.id), question, flag }
}
