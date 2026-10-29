# Render video

`svjeez video` encodes a scene as MP4 or WebM by playing it in headless Chromium and encoding frames with WebCodecs through `@svjeez/video`. The format follows `--out`'s extension unless `--format` says otherwise. The last line names the file, codec, frame count, duration and color scheme.

## Sub-features

- `video-mp4` encodes H.264 MP4 by default.
- `video-webm` encodes VP9 WebM when `--out` ends in `.webm` or `--format webm`.
- `video-options` honors `--fps`, `--loops`, `--quality`, `--scale`, `--color-scheme`.
- `video-alpha` keeps transparency with `--background transparent` in WebM only.
- `video-mismatch` exits 1 when `--format` and the `--out` extension disagree.
- `video-missing-package` exits 1 with an install hint when `@svjeez/video` isn't resolvable.

## How to get to it (user POV)

- `npx svjeez video scene.tsx --out scene.mp4` in a project with `@svjeez/video` installed.
- `bun run render-video <file>` in `examples/`.

## Driving it with verify

Preconditions:

- Baseline from the README. `$V cli` runs from `examples/`, which depends on `@svjeez/video`.

- **WebM.** Run `$V cli video readme/basic.tsx --out $VERIFY_RUN/evidence/basic.webm --fps 10 --scale 1`. Exit 0, last line `…basic.webm: vp9, 40 frames, 4s, light`. The file is non-empty.
- **MP4.** Run `$V cli video readme/basic.tsx --out $VERIFY_RUN/evidence/basic.mp4 --fps 10 --scale 1`. Exit 0, codec `avc`.
- **Mismatch.** Run `$V cli video readme/basic.tsx --format webm --out $VERIFY_RUN/evidence/x.mp4`. Exit 1 with `--format webm doesn't match --out …`.
- **Proof.** The `cli.log` lines and the files. To look at a frame, `ffmpeg -i basic.webm -vframes 1 frame.png` if ffmpeg is installed.

## Gotchas

- Without `--out` the video lands in `examples/`, inside the repo.
- Encoding is slow at the default 30 fps. Use `--fps 10 --scale 1` for a quick proof.
- `video-missing-package` is reachable from `packages/svjeez/`, which has no `@svjeez/video`: `(cd packages/svjeez && bun run src/cli.ts video ../../examples/readme/basic.tsx --out $VERIFY_RUN/evidence/y.webm)` exits 1 with ``svjeez video needs @svjeez/video. Install it with `npm i -D @svjeez/video`.`` It bypasses `$V cli`, so paste the output into the report yourself.
