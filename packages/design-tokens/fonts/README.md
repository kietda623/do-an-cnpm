# Shared local fonts

These unmodified TrueType fonts are distributed under their accompanying SIL Open Font License files. All three families include Vietnamese coverage.

- Be Vietnam Pro: regular 400, medium 500, semibold 600, bold 700.
- IBM Plex Mono: regular 400 and medium 500.
- Space Grotesk: variable weight 300–700; the UI uses 500 and 700.

`sources.json` pins the official google/fonts commit, source URLs and SHA-256 digests. `SpaceGrotesk[wght].ttf` is named `SpaceGrotesk-Variable.ttf` locally; its contents are unchanged.

The shared `@marketplace/ui-web/fonts` entry loads these files through `next/font/local`. Existing CSS variable names and `font-display: swap` are retained. Builds and browsers do not contact Google Fonts. Updating a font must retain its license/provenance and verify Vietnamese glyph coverage.
