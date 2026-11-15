import type { InjectionKey } from 'vue'

/** What a FormField tells the TextField it labels (ticket 0995): that field's id, and the ids of the hint and error it
 * shows, for the field's `aria-describedby`, so a screen reader reads them with the field. */
export interface FormFieldContext {
  controlId: () => string | undefined
  describedBy: () => string | undefined
}

export const FORM_FIELD: InjectionKey<FormFieldContext> = Symbol('formField')
