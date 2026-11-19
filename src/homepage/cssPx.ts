/** A length design value in CSS px as `element` resolves it: a `rem` one by the root's font size; none, or no element,
 * is 0. The Homepage's parts that place by measuring read their tokens this way. */
export function cssPx(element: Element | undefined, name: string): number {
  const value = element ? getComputedStyle(element).getPropertyValue(name).trim() : ''
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('rem') ? amount * Number.parseFloat(getComputedStyle(document.documentElement).fontSize) : amount
}
