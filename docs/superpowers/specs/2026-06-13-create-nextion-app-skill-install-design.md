# Create Nextion App Skill Install Design

## Summary

This design adds an optional AI skill install step to the first-run
`create-nextion-app` scaffolding flow.

The first version is intentionally narrow:

- only the initial `create-nextion-app` workflow is in scope
- only project-scoped installation is supported
- installation is never silent by default
- interactive runs detect likely local targets first, then ask for confirmation
- non-interactive runs do not install anything unless the caller explicitly asks

The goal is to make newly scaffolded Nextion projects immediately usable with
supported AI coding assistants without making the scaffolder feel invasive or
unpredictable.

## Goals

- Add a first-class, low-friction way to install the official `nextion` skill
  while scaffolding a project.
- Keep the create flow safe and unsurprising:
  - no silent writes to AI tool config by default
  - no global machine changes
  - no failure path that blocks project creation
- Detect likely local AI tool targets in interactive flows and only ask when
  the question is relevant.
- Support an explicit non-interactive flag for CI, automation, and advanced
  users.
- Standardize on the published `@notionx/skill` installer contract rather than
  re-implementing target-specific write logic in the scaffolder.

## Non-Goals

- Do not add skill installation to `nextion update` in this first version.
- Do not add skill installation to `nextion provision repair`.
- Do not support user-scope installs from the scaffolder in this first version.
- Do not silently auto-install based only on environment detection.
- Do not expose `@notionx/skill` source-selection concerns such as
  `local|github|npm` through the public scaffolder interface.
- Do not make project creation fail when skill installation fails.

## Problem

The repository now has an official `nextion` skill package:

- `@notionx/skill`

That package can install the project guidance into supported targets such as:

- `Trae`
- `Claude`
- `Codex`

Today, users who scaffold a project do not get any prompt or follow-up path to
install the skill. This creates a gap between:

- the ideal guided AI-assisted developer experience for a Nextion project
- the actual first-run experience after `create-nextion-app`

At the same time, the scaffolder should not become opinionated in a way that
silently edits AI configuration files for tools the user does not use.

The first-run experience therefore needs a middle path:

- detect relevant targets when possible
- ask clearly before writing files
- support explicit automation flags
- keep the rest of the create flow independent

## User Experience Principles

The skill install flow should follow five principles:

1. relevance first
2. explicit consent
3. project-local by default
4. non-blocking failure
5. automation-friendly overrides

In practice, that means:

- interactive users only see the question when the scaffolder detects a likely
  supported target
- the default install scope is the generated project, not the user's machine
- users can skip without penalty
- automation never installs unless asked explicitly
- any install error is surfaced as a warning plus a manual retry command

## Scope

### In Scope

- add skill install detection and prompt logic to `create-nextion-app`
- add CLI flags for explicit skill install control
- invoke the published `@notionx/skill` package as the installer
- support project-scoped installs for:
  - `trae`
  - `claude`
  - `codex`
  - `all`
- print concise success, skip, and retry guidance

### Out of Scope

- global install flows
- project update-time re-prompting
- skill uninstall
- skill version pinning controls in the create CLI
- per-target advanced installer flags such as `--force`

## Recommended Behavior

The recommended first-version behavior is:

- interactive default: `auto`
- non-interactive default: `none`
- install scope: `project`
- install source: published npm package

The key behavior difference is:

- interactive runs may ask
- non-interactive runs never ask

## CLI Shape

Add a new flag:

```bash
--install-skill <mode>
```

Recommended accepted values:

- `auto`
- `none`
- `prompt`
- `trae`
- `claude`
- `codex`
- `all`

### Meaning Of Each Mode

- `auto`
  - interactive only: detect local targets, ask only if at least one likely
    target is found
  - non-interactive: behave like `none`
- `none`
  - skip skill installation entirely
- `prompt`
  - always ask in interactive mode, even if no target was auto-detected
  - invalid in non-interactive mode unless combined with a fallback policy
- `trae`, `claude`, `codex`, `all`
  - explicit install targets
  - interactive mode may still show a confirmation prompt
  - non-interactive mode installs directly without prompting

### Defaulting Rules

- no flag + interactive TTY: `auto`
- no flag + `--yes`: `none`
- no flag + non-TTY: `none`

This preserves today's automation behavior while improving the interactive
experience for human users.

## Detection Model

Detection should be best-effort and conservative.

The scaffolder should not claim that a target exists unless there is a credible
local signal.

### Target Signals

#### Trae

Use one or more of:

- `~/.trae`
- known Trae config directory markers
- optional executable check if a stable `trae` command exists

#### Claude

Use one or more of:

- `~/.claude`
- optional executable check for `claude`

#### Codex

Use one or more of:

- `~/.codex`
- optional executable check for `codex`

### Detection Outcome

The detector returns a set of likely targets:

- empty set
- one target
- multiple targets

If the result is empty:

- `auto` asks nothing and skips
- `prompt` still asks

If the result is non-empty:

- `auto` shows a skill-install prompt preselected to the detected targets

### Detection Philosophy

- false positives are worse than false negatives
- detection must never throw a fatal error
- inability to detect anything is a normal outcome

## Interactive Flow

The current create flow is intentionally light. The skill install step should
preserve that quality.

Recommended insertion point:

- after the main scaffold confirmation
- before the rendering or immediately after render

The recommended first version places the skill question after the user confirms
project generation and before the final create/provision summary logic. This
keeps the question close to project setup while separating it from the initial
minimal "what should I generate?" prompt flow.

### Auto Mode

If `--install-skill` is omitted and the run is interactive:

1. detect likely targets
2. if none found, continue silently
3. if one or more found, ask whether to install the skill for this project
4. if accepted, allow multi-select target confirmation using detected values as
   the defaults
5. run the installer

### Prompt Copy

The prompt language should be concrete about what will be written.

Example:

```text
Detected AI tools: Trae, Codex

Install the official nextion AI skill for this project?
This writes project-local files such as:
  ./.trae/skills/nextion/
  ./AGENTS.md
```

For a single target, the copy can be simpler:

```text
Detected Trae on this machine.
Install the official nextion AI skill for this project?
This writes ./.trae/skills/nextion/
```

### Multi-Select Behavior

When multiple targets are detected:

- show a multi-select list
- preselect the detected targets
- allow the user to deselect any of them
- if the final selection is empty, skip installation

## Non-Interactive Behavior

Non-interactive runs must remain deterministic.

### No Explicit Skill Flag

If the caller passes `--yes` or runs without a TTY and does not explicitly pass
`--install-skill`, the scaffolder should:

- skip skill installation
- print nothing extra beyond an optional concise note

### Explicit Skill Flag

If the caller passes an explicit target:

```bash
--install-skill trae
--install-skill claude
--install-skill codex
--install-skill all
```

the scaffolder should install directly without prompting.

This supports CI, scripted demos, and power users while keeping the default
automation path clean.

## Installer Invocation

The scaffolder should not duplicate the install logic that already lives in
`@notionx/skill`.

Recommended contract:

```bash
npx @notionx/skill install --target <target> --scope project --cwd <projectDir>
```

For `all`:

```bash
npx @notionx/skill install --target all --scope project --cwd <projectDir>
```

### Why Use The Published Installer

- one source of truth for target file layout
- less drift between the create flow and the standalone skill installer
- simpler maintenance when targets evolve
- avoids copying target-specific file-writing logic into the scaffolder

## Install Timing

The install step should happen after the project directory exists.

Recommended order:

1. gather answers
2. render project files
3. optionally install skill
4. run provisioning
5. print final next steps

This ordering ensures:

- the project path is real before project-scoped install runs
- skill installation cannot interfere with rendering
- installation warnings can be reported alongside the rest of the post-create
  summary

## Failure Handling

Skill installation is best-effort.

If the installer fails:

- log a warning
- continue the rest of the create flow
- print a manual retry command

Example:

```text
Skill install skipped due to an error:
  <message>

You can retry later with:
  npx @notionx/skill install --target trae --scope project --cwd <projectDir>
```

### Failure Cases To Handle

- `npx` resolution fails
- network is unavailable
- target package install exits non-zero
- target selection is empty
- detector returns no targets

None of these should convert a successful scaffold into a failed scaffold unless
the user explicitly asked for strict behavior in some future version.

## Output Summary

The post-create summary should distinguish between:

- installed
- skipped by user
- skipped because no target was detected
- failed with retry guidance

Example result lines:

- `AI skill: installed for Trae`
- `AI skill: installed for Trae, Codex`
- `AI skill: skipped`
- `AI skill: no supported target detected`
- `AI skill: install failed; see retry command below`

## README And Help Updates

The public docs for `@notionx/create-nextion-app` should mention:

- the new `--install-skill` flag
- that the scaffolder may detect supported AI tools in interactive mode
- that only project-local installation is supported in the create flow
- that `--yes` does not install by default

The help text should include short, direct wording.

Recommended help copy:

- `--install-skill <mode>    Install nextion AI skill: auto, none, prompt, trae, claude, codex, all`

## Testing

### Unit Tests

- parse `--install-skill` values correctly
- apply correct defaults for interactive vs non-interactive runs
- map detector results to prompt behavior correctly
- build the correct installer command for each explicit target

### Integration Tests

- interactive `auto` with no detected target does not ask
- interactive `auto` with one detected target asks and installs on acceptance
- interactive `auto` with multiple targets preselects the detected set
- `--yes` with no explicit skill target skips installation
- `--yes --install-skill trae` installs without prompting
- installer failure warns and does not abort project creation

### Regression Coverage

- existing create flows without skill flags still work
- non-TTY flows remain non-blocking
- provisioning still runs even when skill installation fails or is skipped

## Rollout Plan

### Phase 1

- implement skill install only in `create-nextion-app`
- project-scope only
- interactive detect-then-ask
- non-interactive explicit-only

### Phase 2

- evaluate whether `nextion update` should offer a lightweight "skill missing"
  reminder or opt-in install prompt

### Explicitly Deferred

- `nextion provision repair`
- user-scope install from the scaffolder
- silent install based on detection

## Open Questions

The first implementation should keep these decisions simple, but they still
need to be made explicitly:

1. Should explicit interactive targets such as `--install-skill trae` still ask
   for confirmation, or should they install immediately?
2. Should `prompt` be allowed in non-interactive mode as an error, or silently
   degrade to `none`?
3. Should the detector check only config directories, or also PATH executables?

Recommended answers for v1:

1. explicit targets install immediately
2. `prompt` in non-interactive mode becomes an error with a helpful message
3. config directories are primary; PATH checks are optional secondary signals

## Recommendation

Ship the smallest version that feels intentional:

- add `--install-skill`
- default to `auto` only for interactive runs
- detect likely targets conservatively
- ask before writing
- install only into the generated project
- treat all skill installation as best-effort

This gives Nextion a noticeably better first-run AI experience without changing
the scaffolder's current safety profile.
