# 05: Switch between multiple saved Patterns

**What to build:** Replace the current single-Pattern storage model (one `bd-beads:pattern` localStorage entry, no way back to the New Pattern form once it's filled) with support for several saved Patterns side by side. The user should always be able to see which Pattern is currently open, switch to another saved one, remove one, and start a new one without losing the rest. For now, surface this as a list of saved Patterns below the pattern canvas — a full project-picker screen can come later.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The UI always shows which Pattern is currently open (e.g. a name or its bead/size summary)
- [ ] A list of all saved Patterns renders below the pattern canvas; clicking one switches the editor to show it
- [ ] Each Pattern in the list can be removed; removing the one currently open switches to another existing Pattern if any remain, or to an empty home screen if none do
- [ ] A visible "new Pattern" action is available at all times (not just on first visit), so the user can start another Pattern alongside existing ones
- [ ] All saved Patterns persist to localStorage per [ADR 0001](../../../docs/adr/0001-local-only-persistence.md), replacing the single-Pattern storage key
- [ ] New and existing labels/buttons for this feature plug into the i18n mechanism from ticket 03 and the design tokens from ticket 02, rather than one-off styling or hardcoded text
