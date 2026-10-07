/** What a Tooltip says (ticket 327, ADR 0035): a name, and optionally a key chip and a body. A disabled control has to
 * say why (`disabledBody`, shown in place of the body) and shows no key chip. */
export type TooltipProps = {
  name: string
  body?: string
  placement?: 'top' | 'bottom'
  announce?: boolean
} & (
  | { hotkey?: string; disabled?: false; disabledBody?: undefined }
  | { hotkey?: undefined; disabled: true; disabledBody: string }
)
