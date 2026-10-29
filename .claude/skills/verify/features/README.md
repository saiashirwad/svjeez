# svjeez verification map

This directory is the maintained source for verifying what svjeez users see and touch. Read the index, then use the matching feature file as the recipe.

## Baseline preconditions

- `bun install` has run at the root, and Chromium headless shell is installed (see `../SKILL.md`, Launch).
- A run exists: `V=.claude/skills/verify/bin/verify; eval "$($V new)"`.
- `$V doctor` reports `doctor: healthy`.
- Never drive a preview this run didn't start. `$V doctor --preview` proves ownership.

## Driving conventions

- Run every command from the repo root.
- Run the CLI through `$V cli`, so `examples/` is the working directory and the call is logged.
- Scene paths: `readme/hero.tsx`, `readme/basic.tsx` and the other `examples/` paths are relative to `examples/`. The skill's own examples are at `packages/svjeez/skills/svjeez/examples/` and need the full path.
- Scratch scenes go in `$VERIFY_RUN/scratch/`. A scratch scene can't import `svjeez` (no `node_modules` there), so make it export a plain SVG string. For a scene that imports svjeez, use one from `examples/` or the skill's examples.
- Never edit repo files to drive a feature. Change scratch files instead.

## Proof and skip reporting

- CLI proof: the `evidence/cli.log` entry (command, output, exit code) and the file it wrote.
- Preview proof: the `<label>.json` and its screenshots.
- Frame proof: open the PNGs and say what is drawn at each time.
- Record the feature ID with every artifact you cite.
- A path you couldn't reach is reported with the command tried and the unmet precondition, never as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior, then four H2 sections in order: `Sub-features`, `How to get to it (user POV)`, `Driving it with verify`, `Gotchas`.

## Features

- [Compile a scene to SVG](./compile-svg.md): `svjeez svg`, to a file or stdout, with warnings and load errors.
- [Render frames](./render-frames.md): `svjeez frames`, PNGs at chosen times or counts, contact sheets, color schemes.
- [Live preview](./dev-preview.md): `bun run dev <file.tsx>`, playback, pause, scrubbing, rebuild on save, the error panel.
- [Render video](./render-video.md): `svjeez video`, MP4 or WebM through `@svjeez/video`.
- [Scene-writing skill](./skill.md): `svjeez skill`, printing it and installing it with references and examples.
