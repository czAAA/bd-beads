/** What a Tooltip says (ticket 327, ADR 0035): a name, and optionally a key chip and a body. A disabled control has to
 * say why (`disabledBody`, shown in place of the body) and shows no key chip. */
export type TooltipProps = {
  name: string
  body?: string
  placement?: 'top' | 'bottom'
  /** `end` lines the bubble's right edge up with its trigger's (the save ring, at the drawing area's right; ticket 0796). */
  align?: 'center' | 'end'
  /** Quiet lines under the body (`meta-tiny`, `tooltip-muted`): facts about the control's state (the save ring's). */
  meta?: readonly string[]
  announce?: boolean
} & (
  | { hotkey?: string; disabled?: false; disabledBody?: undefined }
  | { hotkey?: undefined; disabled: true; disabledBody: string }
)
