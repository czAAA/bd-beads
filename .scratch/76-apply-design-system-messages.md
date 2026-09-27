# 76: Apply design system to messages/popups

**What to build:** Restyle toasts/messages, the library-wide notice row, confirmation dialogs and popups (e.g. the storage-full message, Delete all/Replace Bead confirmations) using the design system's message and popup/modal/menu templates (the `Message`, `Modal` and `Menu` cards), in both themes. This ticket also builds the shared primitives the other redesign tickets reuse: the **Modal** (scrim, focus trap, Escape and scrim to cancel, focus returns to the opener), the **Menu** (anchored under its button, keyboard navigable) and the **Tooltip**.

**Blocked by:** 157

**Status:** done

**Design system v13:** the stacking order and motion come from `accessibility.md` and `interaction-and-motion.md` (toasts above sheets, below modals). Confirmations follow `writing.md`: the title is the question, Cancel on the left and focused first, the confirm button repeats the title. The component card(s) in `docs/design/system/components/` are the spec: Message, Modal, Menu, ConfirmDialogs.

- [x] All existing messages, confirmations, and popups use the new templates
- [x] Messages have the tone edges (`--accent`, `--warning`, `--danger`), a 16px tone icon, optional actions and a close ×; short-lived results toast at the bottom-right of the canvas box for 5s unless hovered or focused, and errors stay until closed
- [x] The library-wide notice row keeps its own row under the header, full width, only taking space while there is something to say
- [x] Modal, Menu and Tooltip exist as shared components with the behavior in the `Modal` and `Menu` cards, and are used by the confirmations here
- [x] Existing confirmation flows (Delete all, Replace Bead) behave unchanged, only restyled
- [x] Every icon comes from the Icon component; no hardcoded colors, fonts, sizes or shadows
- [x] Correct in both the light and the dark theme
- [x] Modals, menus, toasts and tooltips use the z-index and motion tokens

**Done (ticket 76):** AppModal, AppMenu (with AppMenuItem) and AppMessage are the shared components, with the Tooltip from ticket 157 now fading in on the motion tokens. Every overlay is a layer on one Escape stack (useEscapeLayer), so Escape closes the top-most one first and the app's own Escape and hotkeys wait. Delete all, Replace bead, Change size and the import question are ConfirmModals on AppModal; the save failure is a danger Message in the notice row; Save's "Saved" is a toast in the canvas box (5s, now held while hovered or focused), no longer a line in the Toolbox. Import results stay the one-line ImportResult beside their buttons. The QR export panel, Keyboard shortcuts and the two color pickers move onto AppModal and the popover in ticket 151, and the Export menu is the first AppMenu (ticket 148).
