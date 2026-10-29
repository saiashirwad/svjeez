# Live preview

`bun run dev <file.tsx>` serves a page that plays the scene in a loop, with a play/pause button, a scrubber over one loop and a clock. Saving the scene, or any file in `packages/svjeez/src/`, rebuilds it in a fresh process and the page reloads the SVG. A failed build shows its error on the page instead of the scene.

## Sub-features

- `preview-play` plays the scene and advances the clock.
- `preview-pause` stops the clock and holds the frame; the button then reads `play`.
- `preview-scrub` seeks to the scrubber's time and pauses there.
- `preview-rebuild` rebuilds on save; `/state` version goes up and the page shows the new SVG without a reload.
- `preview-error` shows a build error in the error panel, and the next good save clears it.

## How to get to it (user POV)

- `bun run dev <file.tsx>` in `packages/svjeez/` or `examples/`, then open the printed URL (port 5173 unless `PORT` is set).

## Driving it with verify

Preconditions:

- Baseline from the README. No preview running for this run.

- **Start.** Run `$V preview start packages/svjeez/skills/svjeez/examples/orbit.tsx`, then `$V doctor --preview`. Ready line and `doctor: healthy`.
- **Play, pause, scrub.** Run `$V preview drive --at 2.5 --name orbit`. JSON shows `"title": "Orbit"`, `"duration": 6`, `playing.after` later than `playing.before`, `"toggle": "play"`, and `scrubbedTo` and `heldAfterPause` both `2.50s / 6.00s`. In `orbit-at-2.5s.png` the moon sits left of the planet and below its center.
- **Error panel.** Stop, then start on a scratch scene: `printf 'export default () => \`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40"><title>one</title></svg>\`;\n' > $VERIFY_RUN/scratch/live.ts` and `$V preview start $VERIFY_RUN/scratch/live.ts`. Overwrite it with `printf 'export default () => { throw new Error("boom-verify"); };\n' > $VERIFY_RUN/scratch/live.ts`. Within about a second, `curl -s $URL/state` (after `source $VERIFY_RUN/scratch/preview.env`) has version 2 and an `error` containing `boom-verify`. `$V preview drive --name broken` writes `broken-error.png` with the stack trace on the page.
- **Rebuild clears it.** Write the first scene back with `<title>two</title>`. `/state` reaches version 3 with no `error`, and `$V preview drive --name fixed` reports `"title": "two"` and `"error": null`.
- **Proof.** The JSON files and screenshots, plus `evidence/preview-server.log`, where each build prints `✓` or `✗`.

## Gotchas

- `bun run dev` without `--out` writes `packages/svjeez/.preview/<name>.svg`. `$V preview start` passes `--out` into scratch instead.
- The watcher ignores `.svg` files and dotfiles. Saving them doesn't rebuild.
- A scene with no animations has a loop length of 0, which the page shows as `1.00s`.
- The scrubber's `max` is the loop length, so `--at` past it clamps to the end.
- `PORT` in use makes the server fail to start. `$V preview start` picks a free port.
