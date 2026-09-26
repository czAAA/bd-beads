# 149: New Pattern form restyle

**What to build:** The New Pattern form (shown when no Pattern is open, or from New Pattern) takes the Toolbox's place as the first left-column box, styled as a Toolbox-like panel (`DESIGN.md` §4.2, marked Derived). Its inputs, selects, the Bead and Technique choices, the size, cap and error messages all use the new tokens and control variants. Where `DESIGN.md` doesn't say how something looks, extend it first and mark it **Derived**.

**Blocked by:** 141, 157

**Status:** ready-for-agent

**Design system v13:** this ticket also builds the form controls from `forms-and-states.md` and their cards: TextField, NumberField (unit inside, numeric keyboard), native Select, Stepper, SegmentedControl (labels may wrap to two lines), Switch and FileButton. Fields are 40px; labels sit above; errors say what to enter. The Change size modal (ticket 153) is restyled with them too. The component card(s) in `docs/design/system/components/` are the spec: NewPatternForm, TextField, NumberField, Stepper, SegmentedControl, SwitchAndFileButton.

- [ ] The form uses the panel, control, label and meta styles from `DESIGN.md`; primary action uses the accent, and two primary buttons never sit side by side
- [ ] Validation and error messages use the `--danger` and message styles and are unchanged in wording and behavior
- [ ] Any new pattern the form needs is added to `DESIGN.md` as Derived before it is built
- [ ] Every icon this ticket touches comes from the shared Icon component (ticket 137), not an inline drawing
- [ ] No hardcoded colors, fonts, sizes or shadows: only the role-named tokens from `DESIGN.md` §3
- [ ] Correct in both the light and the dark theme
- [ ] All existing New Pattern behavior and tests pass
- [ ] The form controls exist as shared components with every state (focus, error, disabled) and are used by New Pattern and Change size
- [ ] In Russian the Technique SegmentedControl wraps to two lines and every segment keeps the same height
