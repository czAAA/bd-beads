# 149: New Pattern form restyle

**What to build:** The New Pattern form (shown when no Pattern is open, or from New Pattern) takes the Toolbox's place as the first left-column box, styled as a Toolbox-like panel (the `Toolbox` card, marked Derived). Its inputs, selects, the Bead and Technique choices, the size, cap and error messages all use the new tokens and control variants. Where `DESIGN.md` doesn't say how something looks, extend it first and mark it **Derived**.

**Blocked by:** 141, 157

**Status:** done

**Design system v13:** this ticket also builds the form controls from `forms-and-states.md` and their cards: TextField, NumberField (unit inside, numeric keyboard), native Select, Stepper, SegmentedControl (labels may wrap to two lines), Switch and FileButton. Fields are 40px; labels sit above; errors say what to enter. The Change size modal (ticket 153) is restyled with them too. The component card(s) in `docs/design/system/components/` are the spec: NewPatternForm, TextField, NumberField, Stepper, SegmentedControl, SwitchAndFileButton.

- [x] The form uses the panel, control, label and meta styles from `DESIGN.md`; primary action uses the accent, and two primary buttons never sit side by side
- [x] Validation and error messages use the `--danger` and message styles and are unchanged in wording and behavior
- [x] Any new pattern the form needs is added to the design system on claude.ai before it is built (`DESIGN.md` §2)
- [x] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [x] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from the design system's `tokens.json` (`DESIGN.md` §3)
- [x] Correct in both the light and the dark theme
- [x] All existing New Pattern behavior and tests pass
- [x] The form controls exist as shared components with every state (focus, error, disabled) and are used by New Pattern and Change size
- [x] In Russian the Technique SegmentedControl wraps to two lines and every segment keeps the same height

**Done (ticket 149):** the form controls are shared components in `src/components/form/`: FormField (label, "optional" or a note at its right, hint, error with the warning icon), TextField and NumberField (40px, unit inside, `numeric`/`decimal` keyboards), FieldSelect (the native select in the field look), SegmentedControl (a one-tab-stop radiogroup whose labels wrap with equal heights), AppStepper (named for the lint rule) and FileButton (dashed, takes a dropped picture, limits and the disabled reason written under it). The Switch is ticket 144's AppSwitch. New Pattern and Change size use them; Technique and Unit (and Change size's Unit) are SegmentedControls, so the tests now pick an option by `[data-value]` instead of setting a select. Nothing needed adding to the design system: every piece is in the NewPatternForm, TextField, NumberField, Stepper, SegmentedControl and SwitchAndFileButton cards, and the new field errors ("Enter a height.", shown once a size field is left empty or not whole) are `writing.md`'s Field error pattern; the existing messages keep their wording. The Stepper waits for its first user in ticket 150 (Colors at most). Confirmations' Cancel takes the in-box look, since the dark `button` fill equals the dialog's.
