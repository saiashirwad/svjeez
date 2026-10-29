# Compile a scene to SVG

A user points `svjeez svg` at a module whose default export is an SVG string or a function returning one, and gets one self-contained animated SVG, on stdout or in a file. Lint warnings go to stderr and don't fail the command. A module that exports something else fails with a fix.

## Sub-features

- `svg-file` writes the SVG to `--out` and exits 0.
- `svg-stdout` prints the SVG when `--out` is absent.
- `svg-warnings` prints `warning: …` lines from `validateSvg` without failing.
- `svg-bad-export` exits 1 with `<file> must export default an SVG string, or a function that returns one.`
- `svg-usage` exits 1 with the usage text when no file is given.

## How to get to it (user POV)

- `npx svjeez svg scene.tsx --out scene.svg` in a project.
- `bun run src/cli.ts svg <file>` in `packages/svjeez/`.

## Driving it with verify

Preconditions:

- Baseline from the README.

- **File output.** Run `$V cli svg readme/hero.tsx --out $VERIFY_RUN/evidence/hero.svg`. Exit 0, and `head -c 300 $VERIFY_RUN/evidence/hero.svg` shows an `<svg` root with a `<title>`, and `grep -c '@keyframes' $VERIFY_RUN/evidence/hero.svg` is above 0.
- **Stdout.** Run `$V cli svg "$PWD/packages/svjeez/skills/svjeez/examples/orbit.tsx"`. Exit 0, and the log shows the SVG text with `<title id="t">Orbit</title>`.
- **Bad export.** Run `echo 'export default 42' > $VERIFY_RUN/scratch/bad.ts` then `$V cli svg $VERIFY_RUN/scratch/bad.ts`. Exit 1 with the `must export default` message.
- **Usage.** Run `$V cli svg`. Exit 1 with the usage text.
- **Proof.** Render the written file: `$V cli frames $VERIFY_RUN/evidence/hero.svg --count 4 --sheet --out $VERIFY_RUN/evidence/hero-svg-frames`, then open `sheet.png`.

## Gotchas

- `--out` is relative to `examples/` under `$V cli`. Use absolute paths into the run.
- Warnings are not failures. Read stderr in `cli.log` even when the exit code is 0.
- `bun run build` in `examples/` is a different path: it also runs `xmllint` and writes `examples/dist/`. Don't use it as proof of `svjeez svg`, and don't run it here, since it rewrites committed files.
