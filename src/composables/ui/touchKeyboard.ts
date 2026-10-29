// What raises a phone or tablet's keyboard (tickets 520, 0688): a text field focused on a touch device.

const NON_TEXT_INPUTS = new Set(['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'])

/** An element that takes typed text, so focusing it raises the keyboard. */
export function isTextField(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement) return true
  if (element instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(element.type)
  const editable = element.getAttribute('contenteditable')
  return editable !== null && editable !== 'false'
}

/** A touch device: its main pointer is a finger, and a text field's focus raises an on-screen keyboard. */
export function coarsePointer(win: Window = window): boolean {
  return typeof win.matchMedia === 'function' && win.matchMedia('(pointer: coarse)').matches
}

/** Whether focusing this element by code would raise the keyboard. A shell that picks where focus goes (a dialog, a
 * panel) starts on itself instead (tickets 516, 0688): the tap that opened it lets the touch focus guard pass. */
export function wouldRaiseKeyboard(element: Element | null | undefined): boolean {
  return !!element && isTextField(element) && coarsePointer()
}
