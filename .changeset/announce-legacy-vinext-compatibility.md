---
"@notionx/create-nextion-app": patch
---

Feat: `nextion update` now prints a `compatibility:` block when the
project's `.nextion/scaffold.json` opts into `compatibility: "legacy-vinext"`
(or already pins `nextionSource: "workspace:*"`). The block calls out
that the workspace symlink is preserved on purpose, so operators can see
why `nextionSource` is not being upgraded to a real semver.

`UpdateSummary.compatibilityPreserved` is now optional on the public
type, so ad-hoc fixtures and harnesses don't have to set it. `runUpdate`
still always populates the field.
