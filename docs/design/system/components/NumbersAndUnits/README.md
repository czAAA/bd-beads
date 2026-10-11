# NumbersAndUnits

How counts, sizes, weights, units, percentages, ranges and dates are written in English and Russian.

- Counts group thousands with a no-break space in both languages: "1 424". Decimals: "9.6" / "9,6".
- Grid sizes "60×80"; wherever a Pattern size is labelled it is Width and Height ("Width 60 · Height 80"), never columns and rows (those stay in Row progress, Row direction and Remove row/column). A size typed in mm always rounds up to the next whole bead, and the mm shown for a count of beads is an estimate (ticket 342); measured sizes "9.6 × 10.4 cm" / "9,6 × 10,4 см" (cm from 10 mm up); weights "≈ 24 g" / "≈ 24 г", rounded up to 0.1 g.
- A no-break space before units; Russian also before %: "62 %". Ranges with an en dash: "2–14". Dates with `Intl.DateTimeFormat`, month short. Bead names as the maker writes them.

Hand-written from the Phase D sign-off.
