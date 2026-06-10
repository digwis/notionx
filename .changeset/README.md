# Changesets

This directory holds [changesets](https://github.com/changesets/changesets) for
packages in the vinext monorepo. Each `.md` file in this folder is a pending
release note: when CI runs on `main`, the `release` workflow applies all
pending changesets (bumps the version, writes the changelog, publishes the
package) and then deletes the consumed files.

Only `@nextion/core` is published (to GitHub Packages). Everything else
in this monorepo — `apps/*`, the `tools/*` workspace packages, the
`@vinext/starter` app — is private and never released.

## Adding a changeset

```bash
pnpm changeset            # walk through the bump type + changelog
```

The interactive prompt creates a new `.md` file in this directory. Open a PR
with the new file; the release workflow consumes it on merge to `main`.
