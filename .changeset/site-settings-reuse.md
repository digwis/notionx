---
"@notionx/create-nextion-app": patch
---

Fix: `nextion update` and `pnpm provision repair` no longer create a new
Site Settings data source on every run. The provisioner now reuses the
existing one via the `[nextion-scaffold] key=site-settings` marker, and
falls back to a title match for projects scaffolded before the marker
existed. The provision summary line marks reused vs created.
