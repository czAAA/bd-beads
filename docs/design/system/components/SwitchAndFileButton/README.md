# SwitchAndFileButton

The labelled on/off Switch, and the FileButton that opens the file picker with its limits written under it.

- Switch: the Progress bar switch (30×18) with a label on the left; the whole row is the target (44px). Used again since ticket 0474 by the Progress bar's Row highlight, without the visible label (its Tooltip names it); `AppSwitch` was brought back after ticket 426 removed it.
- FileButton: opens the system file picker; a dashed border says "a file goes here", and a picture can also be dropped on it on desktop. Its limits are always written under it.
- Disabled FileButton says why under it, in words.

Hand-written from the Phase A sign-off (forms, screens and states); static rendition.
