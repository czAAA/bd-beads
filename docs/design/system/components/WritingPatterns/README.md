# WritingPatterns

How the app talks: the voice, and one sentence pattern for each kind of message, in English and Russian.

- Error: what happened, what to do. Field error: what to enter. Empty: what is missing, what to do next. Result: "Label: number" or one word. Loading: doing what · to what. Confirm: the title is the question, the button repeats it.
- No "please", "oops", exclamation marks, emoji or blame. US English; Russian with «ёлочки», ё always written, product nouns lowercase.
- Prefer "Label: number" to avoid plurals; otherwise `Intl.PluralRules` (Russian one, few, many). Size controls for the Russian string; only Pattern names may be cut with an ellipsis.

Hand-written from the Phase D sign-off.
