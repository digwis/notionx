---
"@notionx/create-nextion-app": patch
---

The Site Settings data source now carries 17 properties (up from 5):
Meta Title, Meta Description, OG Image, Nav, Nav CTA, Primary Color,
Accent Color, Font Family, Footer Columns, Footer Copyright, Footer
Social Links, and Footer Tagline. The scaffolder seeds safe defaults
for all 17 and the runtime loader wires them into the layout,
header (multi-level nav + CTA), footer (multi-column), and
`<html data-theme-*>` attributes picked up by a new
`components/site/theme-bootstrap.tsx` client component.
