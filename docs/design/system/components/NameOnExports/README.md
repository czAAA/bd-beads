# NameOnExports

Where the Maker's name for a Project's PDF and PNG exports is set: the last row of Project (ProjectPanel card). It belongs to the Project, not the device (ADR 0060, ticket 0441).

- **Unset:** an open TextField, label "Name on exports", placeholder "Your name", counter "0/40", hint "Printed on this Project's PDF and PNG exports." Enter or leaving the field saves; empty prints no name.
- **Set:** one row, the label in `label` style, the name in Inter 500 and a pencil ("Edit Name on exports"). The pencil swaps the name for the field; clearing it returns the row to unset.
- Up to 40 characters, optional. Saved at once and not part of Undo.
- It applies to that Project only, so Projects made for others carry their own name. The exports leave the name out when it is empty; when set it is printed as information (made by, the chart page header, "by {maker}" on the PNG), never as a watermark (printed-output.md).
- **Gone:** the row in the Export ▾ menu, the modal with Cancel and Save, the Dock Menu panel row, and the device-wide name. A name saved on a device before the update is copied into each Project that has none (a temporary migration, removed by ticket 0391), then cleared.

Rewritten for spec 0440; the earlier card (a device-wide name in the Export menu and a modal) is in git history.
