# 232: Confirm before removing or switching to a Saved Pattern

**What to build:** In Saved Patterns, the remove × on a thumbnail and picking a thumbnail to open it each ask first, so a stray tap neither deletes a Pattern nor swaps the open one out from under the person. Both use the existing confirmation (ticket 76), as Import's "Switch to the imported Pattern?" already does (ticket 154).

- **Remove:** a danger-styled confirmation naming the Pattern. Only confirming deletes it.
- **Switch:** a primary-styled "Switch" confirmation saying which Pattern is being left and which is being opened. Only confirming opens the picked Pattern. If the current Pattern failed to save, the message says so and offers saving first or switching anyway, reusing Import's wording and behaviour.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Pressing × on a saved thumbnail opens a danger-styled confirmation naming the Pattern, with Cancel focused first; the Pattern is deleted only on confirm
- [x] Cancel, Escape and clicking outside leave the Pattern in the library, and the open Pattern unchanged
- [x] Removing the open Pattern behaves exactly as it does today after confirming
- [x] Picking a different saved thumbnail opens a primary-styled "Switch" confirmation naming the current and the picked Pattern; the switch happens only on confirm
- [x] Cancel keeps the current Pattern open, with its grid, undo history and Row progress untouched
- [x] Picking the Pattern that is already open does nothing and shows no confirmation
- [x] When the current Pattern is not saved on this device, the switch message says so and offers "Save first" and "Switch anyway", as in Import
- [x] Works from the sidebar list and the phone drawer, by pointer, touch and keyboard
- [x] Correct at all five screen sizes and in the light, dark and high contrast themes; copy in English and Russian; design system tokens only
- [x] CONTEXT.md's saved-patterns entry mentions both confirmations
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)

## Resolution note

The switch confirmation is its own modal (`switch-pattern-modal`) rather than Import's, since its Cancel reads "Keep current" and its Save button "Save first"; it reuses Import's unsaved message and "Switch anyway". On the phone, the Saved Patterns sheets close only once the switch is confirmed.
