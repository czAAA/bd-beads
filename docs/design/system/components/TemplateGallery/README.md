# TemplateGallery

The Templates New Project starts from: a gallery of cards above the form, and the setup sub-view one level under it. (Spec 0488, ticket 0493.)

## Gallery

- The first block of the New Project sub-view, above the form: a **Blank canvas** tile, then one card per Template (Gerdan, Bracelet, Earrings, Bag, Custom scheme), in one `role="radiogroup"` named by the section label ("Start from"). One tab stop; arrows, Home and End move between cards.
- Blank canvas is the checked card while the sub-view is the gallery: it is what the form below makes. A tap on it takes the reader to the Name field. A tap on any other card pushes the setup; nothing stays checked there.
- **Card:** `elevated` fill, 1px `line-strong` edge, `radius-md`, padding 8 10, 10px gap, min height `field-height`. A picture slot at the left (3rem square), then the text: the name in `control` bold, the description in `meta` (`muted`), and for a Template the spec line ("24 × 80 · Loom": width × height in beads, then the default Technique) in DM Mono `meta`, `muted`. Blank canvas shows a `plus` icon in the slot and no spec line.
- **States:** hover `hover-fill`; checked `accent-strong` edge with an inset 1px of the same; keyboard focus the 2px `focus-ring`, 2px away; pressed `press-fill`. High contrast uses the 2px `line-strong` edge and `ink` for the checked one.
- **Tiers:** one column on a phone and in the dropdown; two columns in the Top sheet from 640px wide (it has the room). The cards are the width of their column and wrap their text; nothing is cut.
- **Picture slot:** until the artwork exists (ticket 0494) it holds a plain Frame-shaped lattice of `faint` bead marks in the Template's Technique, so peyote and brick look offset. The slot takes anything else later. The picture is decorative (`aria-hidden`).

## Setup (the sub-view one level deeper)

- Header: Back arrow and the Template's name as the title. The body scrolls; **Create Project** is the primary button in the pinned footer (MenuPanel card, `footer` slot).
- Fields, in order: Name (the Template's name as its placeholder, optional), Bead, Technique (a SegmentedControl of only the Techniques the Template allows; hidden when there is one), Brick block (Stepper card) for brick stitch, the unit (beads or Units, mm, cm) in a SegmentedControl, then Width and Height as Steppers.
- A side is a Stepper counting beads (Units in Right-angle weave and Netting) between the Template's limits; mm or cm only change what the Stepper shows. Below it, the Template's usual sizes as chips (`radius-full`, `line-strong` edge; the one matching is `aria-pressed` with the `accent-strong` edge). A side the Template locks (earrings keep their width) is a disabled Stepper with the note "This side is fixed." and no chips.
- Under the sizes: "Estimated size: 3.1 × 21.5 cm" as the Frame will be, and the Estimated size warning as a Note (Note card).
- It states no Maker's name: the Project takes the device-wide one, as a blank Project does.
- Create makes a Project whose Frame is in place at the origin and empty, Row progress on, the Canvas in the Frame's Technique, named by the Name field or the Template's name. Nothing records the Template in the Project.

## Stack of sub-views

Back and Escape pop one level: setup to gallery, gallery to the Menu list. Focus returns to the card that opened the setup. Where the panel opened on the New Project sub-view (an empty library), Escape on the gallery closes the panel (MenuPanel card).

Hand-written for spec 0488; the Vue components `TemplateGallery`, `TemplatePicture` and `TemplateSetup` are the real thing.
