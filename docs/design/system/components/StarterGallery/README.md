# StarterGallery

The Starters New Project starts from: a gallery of cards that New Project's **Pick a starter** button unfolds under the form, and the setup subpanel one level under it. (Spec 0488, ticket 0493.)

## Gallery

- The last block of the New Project subpanel (ticket 0568): the third accent button, **Pick a starter** (`frame`, a chevron), unfolds the gallery under it, folded by default and kept as it was left when Back returns from a setup. One card per Starter (Gerdan, Bracelet, Earrings, Bag, Custom scheme), in one `role="radiogroup"` named by the section label ("Start from"). One tab stop; arrows, Home and End move between cards. The Frame panel's Frame from starter shows the same gallery. There is no Blank canvas card: a blank Project is what Create Project makes.
- A tap on a card pushes the setup; nothing stays checked there.
- **Card:** `elevated` fill, 1px `line-strong` edge, `radius-md`, padding 8 10, 10px gap, min height `field-height`. A picture slot at the left (4.5rem square), then the text: the name in `control` bold, the description in `meta` (`muted`), and for a Starter the spec line ("24 × 80 · Loom": width × height in beads, then the default Technique) in DM Mono `meta`, `muted`. Blank canvas shows a `plus` icon in the slot and no spec line.
- **States:** hover `hover-fill`; checked `accent-strong` edge with an inset 1px of the same; keyboard focus the 2px `focus-ring`, 2px away; pressed `press-fill`. High contrast uses the 2px `line-strong` edge and `ink` for the checked one.
- **Tiers:** one column, in the dropdown at every width. The cards are the width of their column and wrap their text; nothing is cut.
- **Picture slot:** a small decorated example of the piece in the Starter's Technique (ticket 0494): a symmetric ornament (stripes, diamonds or a star, which one is fixed by the Starter) of about eleven beads on its long side, in the Starter's shape, drawn by the Project renderer in the Frame-only space on the `board`, `radius-sm`, 4px padding, and scaled to the slot. Peyote and brick stitch look offset, loom lines up. Its colors are four built-in Palette colors per theme (light: white, red, blue, yellow; dark: white, orange, teal, pink, none near-black; high contrast: white, black, blue, yellow, each beside the board's `rim`). It is only an example: Create still gives an empty Frame. Decorative (`aria-hidden`). Blank canvas keeps its `plus` icon.

## Setup (the subpanel one level deeper)

- Header: Back arrow and the Starter's name as the title. At the top of the body, the same sample in a 6rem square beside a Note, "This is only an example. The Frame starts empty."; the sample follows the Technique chosen below. The body scrolls; **Create Project** is the primary button in the pinned footer (MenuPanel card, `footer` slot).
- Fields, in order: Name (the Starter's name as its placeholder, optional), Bead, Technique (a SegmentedControl of only the Techniques the Starter allows; hidden when there is one), Brick block (Stepper card) for brick stitch, the unit (beads or Units, mm, cm) in a SegmentedControl, then Width and Height as Steppers.
- A side is a Stepper counting beads (Units in Right-angle weave and Netting) between the Starter's limits; mm or cm only change what the Stepper shows. Below it, the Starter's usual sizes as chips (`radius-full`, `line-strong` edge; the one matching is `aria-pressed` with the `accent-strong` edge). A side the Starter locks (earrings keep their width) is a disabled Stepper with the note "This side is fixed." and no chips.
- Under the sizes: "Estimated size: 3.1 × 21.5 cm" as the Frame will be, and the Estimated size warning as a Note (Note card).
- It states no Maker's name: the Project takes the device-wide one, as a blank Project does.
- Create makes a Project whose Frame is in place at the origin and empty, Row progress on, the Canvas in the Frame's Technique, named by the Name field or the Starter's name. Nothing records the Starter in the Project.

## Stack of subpanels

Back and Escape pop one level: setup to gallery, gallery to the Menu list. Focus returns to the card that opened the setup. Where the panel opened on the New Project subpanel (an empty library), Escape on the gallery closes the panel (MenuPanel card).

Hand-written for spec 0488; the Vue components `StarterGallery`, `TemplatePicture` and `TemplateSetup` are the real thing.
