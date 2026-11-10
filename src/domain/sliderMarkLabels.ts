/** Where a label sits along a slider, in px from one edge. */
export interface LabelSpan {
  from: number
  to: number
}

/** Which of a slider's mark labels show (ValueSlider card, ticket 0862): in order, each that stays `gap` clear of the
 * ends' labels and of every label kept before it. The rest are left out; their marks stay. */
export function shownMarkLabels(labels: readonly LabelSpan[], ends: readonly LabelSpan[], gap: number): boolean[] {
  const taken = [...ends]
  return labels.map((label) => {
    const clear = taken.every((other) => label.to + gap <= other.from || label.from >= other.to + gap)
    if (clear) taken.push(label)
    return clear
  })
}
