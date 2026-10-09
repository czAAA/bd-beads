# The Palette is separate from the Bead catalog, and grows from a Color catalog

**Status: accepted.** Tickets 36, 228. Code catches up in ticket 366 (the Color catalog and saved Palettes).

A bead's color comes from the **Palette** (CONTEXT.md), not from a Bead: a bead stores its hex, and any hex is allowed, so a Project can be drawn before anyone knows which real beads it will take, and opens unchanged on a device whose Palette has never had its colors.

**Today** the Palette is twelve built-in colors plus the Custom colors that have painted a bead (at most 28 more, 40 swatches in all), in the order first used. Choosing a color without painting adds nothing, and a hex already there is never added twice. Added colors are kept on the device (`bd-beads:added-colors`), not in a Project; one can be removed, with an Undo toast, and the beads keep their hex. Only the built-in colors have keyboard shortcuts. The Palette is read through `usePalette`; `PALETTE` means the built-in colors only.

**Decided, not built:** the Palette becomes the default colors plus colors a person picks from the **Color catalog**: the real colors of each Bead line, with their maker's codes ([ADR 0007](0007-one-bead-per-pattern-no-color-mapping.md)). Inside a Project the catalog offers the Bead colors of that Project's Bead, so what Beads needed lists can be bought. Building a Palette from the catalog is for everyone, Guests included, on the device. Pro adds Palettes saved to the account and kept in step across devices, so a Palette is built once ([ADR 0014](0014-mvp-stays-local-only-hosted-phase-deferred.md)).

**Considered options**: every bead tied to a catalog entry (rejected: nothing can be drawn before the beads are chosen, and an imported Project with unknown colors would break); a Palette per Project (rejected: a color the maker likes should follow them to the next Project).
