---
name: pr-reel
description: Show a visual change in its pull request as animated SVG reels — a live side-by-side of each changed svjeez scene, a before/after wipe of each page that looks different, and a filmed scroll for each page that moves differently. Use after changing a scene, the site, or anything else a reviewer would want to see rather than read, and before asking for review.
---

# PR reels

`examples/reel/make.ts` builds the reels and writes them into the PR body. GitHub serves files from `github.com/<repo>/raw/<sha>/` as `image/svg+xml`, so the reels animate right in the description. Video does not work there: GitHub strips `<video>` from PR bodies and serves raw MP4s as downloads.

## Run it

1. Build and serve this branch's site: `bun run build` in `site/`, then `bunx astro preview --port 4330` in the background.
2. Edit `examples/reel/shots.ts` to cover the diff:
   - Use `still` for anything that changes how a page looks. It is shot with reduced motion on, so scenes hold still.
   - Use `scroll` for anything that changes how a page moves. It films a scroll to `selector` on each side.
   - A shot where nothing changed is left out of the reel, so listing too many shots only costs time.
3. In `examples/`, run `bun run reel/make.ts`. Changed scene files under `examples/` get a live scene diff without being listed.
4. Look at what it built before posting. Render a sheet with `bun run render-png reel/out/<name>.svg --sheet`, open `sheet.png`, and check that each box surrounds the real change.
5. Post the reels: `bun run reel/make.ts --pr <number>`. This force-pushes the reels to `pr-assets/<number>` and replaces the section between `<!-- reel:start -->` and `<!-- reel:end -->` in the body. Rerunning it updates them in place.

`REEL_BEFORE` (default production), `REEL_AFTER` (default `http://localhost:4330`) and `REEL_BASE` (default `main`) set the two sides. `--only hero,scene-icons` builds just those reels.

## How it decides what changed

- Stills are compared in Chromium on a 12px grid. Changed cells that touch merge into boxes, and the reel is cropped to their union with some margin.
- Each side is shot twice, 1.5s apart. A box that also differs between those two shots is something still moving, not the change, so it is dropped. The command logs how many were dropped.
- Scrolls are compared only after the scroll lands, because the scroll position jitters between runs.
- A scene diff renders main's copy of the file next to this branch's with `prefixed()` and `nest()`, and both copies play on one clock. It is skipped when the two render the same.

## Limits

- A scroll reel is 0.5–1 MB, nearly all of it frames. Keep scroll shots few and their regions small.
- A change in a shared helper, such as `examples/site/kit.tsx`, gets no scene diff, because only scene files are detected. Add a scroll or still shot for the pages that use it.
- Production can lag `main`. When the deploy is behind, set `REEL_BEFORE` to a preview of `main`.
