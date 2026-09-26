# 155: Beads needed shows an estimated weight in grams

**What to build:** The Beads needed box shows how many grams of beads the open Pattern needs, per color and as a total, next to the bead counts it already shows. The weight is an estimate: the bead count multiplied by an average weight of one bead of the Pattern's Bead. An info icon beside it opens a tooltip that says so and shows the average used (for example "Estimated weight: bead count × about 0.0091 g per bead. Real beads vary by color and finish, so buy a little extra."). Terms: CONTEXT.md (Bead quantities, Bead), [ADR 0007](../docs/adr/0007-one-bead-per-pattern-no-color-mapping.md), and the Estimated size pattern in [ADR 0017](../docs/adr/0017-grid-is-the-size-mm-is-an-estimate.md), which is also an estimate shown with an info tooltip and never stored.

**Provisional per-bead weights** (from public seller listings found while writing this ticket; a web search, not a measurement, and not yet confirmed with a dealer, see the last criterion):

| Bead in the catalog | Published count per gram | Grams per bead used |
| --- | --- | --- |
| TOHO Cube 1.5mm | about 93 to 95 | 0.0108 |
| TOHO Round 11/0 | about 105 to 110 | 0.0091 |
| Miyuki Delica 11/0 | about 175 to 200 (a listing states 7.2 g ≈ 1440 beads, i.e. 200) | 0.0050 |

Sources: [Miyuki Delica 11/0 7.2 g ≈ 1440 beads (Amazon listing)](https://www.amazon.com/Miyuki-Delica-Seed-Beads-Galvanized/dp/B00KO6VNP6), [Toho Round 11/0 8 g tubes (Beadaholique)](https://beadaholique.com/products/toho-round-seed-beads-11-49-opaque-jet-8-gram-tube), [Toho Cube 1.5mm (PoCo Inspired)](https://pocobeads.com/en-us/products/sq15-711-toho-1-5mm-8-2g), [Bead conversions (Harlequin Beads)](https://www.harlequinbeads.com/bead-conversions). Counts per gram differ by color and finish, so these are averages, and the Round and Cube figures in particular come from search summaries that need checking.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

**Note:** If ticket 146 (Beads needed as an expandable panel) or 151 lands first, put the weight in whatever layout it leaves; nothing here depends on them.

- [ ] Each Bead in the catalog carries an average weight of one bead in grams, kept in one place beside its other physical data, with a comment naming it provisional until confirmed by a dealer
- [ ] Beads needed shows the estimated grams per color and a total for the Pattern, computed as count × grams per bead and never stored on the Pattern; if a Pattern's Bead has no weight (an unknown or removed Bead), the weights are hidden rather than shown as zero
- [ ] Grams are shown with sensible rounding: one decimal from 10 g up, two decimals below 10 g, and "< 0.01 g" for a color too small to weigh; the unit label follows the app language (g / г)
- [ ] An info icon opens a tooltip on hover and keyboard focus, in the warning color like the Estimated size tooltip, saying it is an estimated weight, that it is the bead count multiplied by the number of grams per bead and showing that number for the Pattern's Bead, and that real beads vary. EN and RU copy
- [ ] The weights update when the Pattern's Bead changes (Replace Bead) and when cells are painted or erased
- [ ] The box follows DESIGN.md in both themes, and the Pattern with no colors painted shows no weight
- [ ] Tests cover all three catalog Beads, the rounding boundaries, the hidden case for a Bead with no weight, and the tooltip text
- [ ] CONTEXT.md gains an entry for Estimated weight (an estimate, derived and never stored, like Estimated size)
- [ ] **Before this is marked done, a person confirms the three per-bead weights with the bead dealer or seller** (or by weighing a counted sample) and updates the table and the comment above. The agent cannot do this: it has no contact with a dealer, so it must leave the values marked provisional and say so when it hands the ticket back
