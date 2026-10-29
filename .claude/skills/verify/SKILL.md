---
name: verify
description: Drive svjeez the way a user does and capture proof. Covers the svjeez CLI (svg, frames, video, skill) and the live dev preview with its scrubber, run from the workspace source. Use to confirm a change to the compiler, the CLI, the preview or an example works in the real tool, not just in tests.
---

# Verify svjeez

svjeez compiles TypeScript scenes into one animated SVG. A user touches it through the `svjeez` CLI and through `bun run dev <file.tsx>`, a local page that plays the scene with a pause button and a scrubber. Both run here from source. Every recipe goes through one helper, `.claude/skills/verify/bin/verify`, run from the repo root.

The feature map in [`features/README.md`](features/README.md) is the list of what to prove. Read it, then open the feature file you need.

Other surfaces are not mapped yet: the Vite plugin's test app (`packages/vite`, `bun run test` / `bun run dev`), the Astro site and its playground (`site/`, `bun run dev`), and `bun run build:examples`. Prove those with their own commands from `AGENTS.md`.

## Launch

Once per machine, from the repo root:

```sh
bun install
cd packages/svjeez && bunx playwright-core install chromium-headless-shell && cd -
```

Every drive belongs to a run. A run is a directory with `evidence/` and `scratch/`, under `$VERIFY_ROOT` (default `$TMPDIR/svjeez-verify`). Set `VERIFY_ROOT` to your scratchpad if you have one.

```sh
V=.claude/skills/verify/bin/verify
eval "$($V new)"          # exports VERIFY_RUN
```

If your shell doesn't keep variables between commands, note the printed path and start each command with `export VERIFY_RUN=<path>; V=.claude/skills/verify/bin/verify`.

The CLI is short-lived and needs no server: `$V cli <args>` runs `packages/svjeez/src/cli.ts` with `examples/` as the working directory, the same as `bun run render-png` there. `examples/` has `tsx` and `@svjeez/video`, so `video` works. Relative scene paths are relative to `examples/`. Pass absolute paths for anything else.

The dev preview is long-lived:

```sh
$V preview start <scene.tsx>    # absolute or repo-relative path
```

It starts `scripts/preview.ts` in a tmux session named `svjeez-verify-<run>`, on a free port, with `--out` in the run's scratch, so it never writes `packages/svjeez/.preview/`. It returns when the port listens and `/state` reports `version >= 1`, meaning the first build finished. It prints the URL and the first state. A state with `"error"` means the scene failed to build, which is a finding, not a launch failure. One preview per run. Start a second run for a second preview.

## Doctor

```sh
$V doctor             # bun, workspace installed, CLI loads from source, Chromium launches
$V doctor --preview   # also: tmux session alive, port owned by this run's pid, last build had no error
```

Read-only. Run it before the first drive, and again after anything surprising. A FAIL on Chromium means rerun the install line in Launch.

## Drive

- CLI: `$V cli <command> <args...>`. It appends the command, its output and `exit N` to `evidence/cli.log`, and exits with the CLI's code. Send outputs into `$VERIFY_RUN/evidence/`.
- Preview: `$V preview drive [--at <seconds>] [--name <label>]`. It opens the page in headless Chromium, reads the clock twice 400ms apart to show it plays, clicks the `pause` button, fills the `#scrub` range with `--at`, and reads `#clock` and `#error` back. It writes `<label>.json` and `<label>-playing.png`, `<label>-at-<s>s.png` or `<label>-error.png` into `evidence/`, and prints the JSON.
- Server state without a browser: `source "$VERIFY_RUN/scratch/preview.env"; curl -s "$URL/state"` gives `{"version":N,"error"?:...}`. `version` counts builds.

Page handles: `#stage svg` is the scene, `#toggle` is the play/pause button (its accessible name is the word it shows), `#scrub` is the range (max = loop length in seconds), `#clock` reads `1.23s / 6.00s`, `#error` holds the build error.

## Evidence

Everything goes in `$VERIFY_RUN/evidence/`, which cleanup never touches. Report that path.

- Use the real user path: the CLI commands and the preview page. Don't call `render()` or `renderFrames()` from a script and call that proof of the CLI.
- Capture the action and the result: `cli.log` holds the command line and exit code, the JSON holds what the page showed before and after each action.
- Look at the frames. `frames --sheet` and the preview screenshots are images. Open them and check the drawing at those times, because a passing exit code doesn't show timing or layout bugs.
- Check side effects: the file the command wrote exists, is non-empty and is what it claims to be. For an SVG, `head -c 300` shows the `<svg` root and `<title>`. For a video, the CLI's last line names the codec and frame count.
- No mocks. The only external system is Google Fonts, for scenes that load fonts through `@svjeez/fonts`. Its cache makes later runs offline.

## Cleanup

```sh
$V cleanup
```

It kills this run's tmux session (by name, never by process name), waits for the port to close, deletes `scratch/`, and lists the evidence it kept. Run it after every failed attempt too. Other runs' sessions and the user's own `bun run dev` are not touched.

## Helpers

- `bin/verify` — the dispatcher above. Run it with no arguments for usage.
- `bin/drive-preview.ts` — the Playwright driver behind `preview drive`. It loads `playwright-core` from `packages/svjeez`, so call it through `verify`, not directly.
