# 76: Apply design system to messages/popups

**What to build:** Restyle toasts/messages, the library-wide notice row, confirmation dialogs and popups (e.g. the storage-full message, Delete all/Replace Bead confirmations) using `DESIGN.md`'s message and popup/modal/menu templates (§5.12–5.13), in both themes. This ticket also builds the shared primitives the other redesign tickets reuse: the **Modal** (scrim, focus trap, Escape and scrim to cancel, focus returns to the opener), the **Menu** (anchored under its button, keyboard navigable) and the **Tooltip**.

**Blocked by:** 157

**Status:** ready-for-agent

**Design system v13:** the stacking order and motion come from `accessibility.md` and `interaction-and-motion.md` (toasts above sheets, below modals). Confirmations follow `writing.md`: the title is the question, Cancel on the left and focused first, the confirm button repeats the title. The component card(s) in `docs/design/system/components/` are the spec: Message, Modal, Menu, ConfirmDialogs.

- [ ] All existing messages, confirmations, and popups use the new templates
- [ ] Messages have the tone edges (`--accent`, `--warning`, `--danger`), a 16px tone icon, optional actions and a close ×; short-lived results toast at the bottom-right of the canvas box for 5s unless hovered or focused, and errors stay until closed
- [ ] The library-wide notice row keeps its own row under the header, full width, only taking space while there is something to say
- [ ] Modal, Menu and Tooltip exist as shared components with the behavior in §5.13, and are used by the confirmations here
- [ ] Existing confirmation flows (Delete all, Replace Bead) behave unchanged, only restyled
- [ ] Every icon comes from the Icon component; no hardcoded colors, fonts, sizes or shadows
- [ ] Correct in both the light and the dark theme
- [ ] Modals, menus, toasts and tooltips use the z-index and motion tokens
