# svjeez, as one file

The svjeez CLI with everything it can carry built in: svjeez, `@svjeez/fonts`, `charts`, `code`, `diagrams`, `geo`, `icons`, `math`, `mermaid` and `video`, TypeScript, and the agent skill. Write a scene file anywhere and run the tools on it. It needs no `package.json`, `node_modules` or `tsconfig.json`.

```sh
curl -fsSL https://raw.githubusercontent.com/saiashirwad/svjeez/main/packages/bin/install.sh | sh
```

`SVJEEZ_VERSION=v0.8.0` installs a given release, and `SVJEEZ_INSTALL=/usr/local/bin` installs somewhere other than `~/.local/bin`. On Windows, download `svjeez-windows-x64.exe` from the [releases](https://github.com/saiashirwad/svjeez/releases).

## Through npm

```sh
npx @svjeez/bin@next check scenes/scene.tsx    # or bunx
```

`@svjeez/bin` is a small launcher, not the executable itself. The first run downloads the build for this machine from the `v<version>` GitHub release, checks it against `svjeez-checksums.txt`, keeps it in `~/.cache/svjeez/bin/<version>` and runs it; later runs start at once. So `npx` needs the network once, and a version can be run this way a few minutes after it reaches npm, once its release has the executables. `SVJEEZ_RELEASES=<url>` downloads from a mirror of the release downloads instead.

The `svjeez` package ships its own `svjeez` command that reads the project's `node_modules`. This one carries everything, for a folder that has none; install one or the other.

## Use

```sh
svjeez init scenes                       # types for your editor, a tsconfig.json and a starter scene.tsx
svjeez check scenes/scene.tsx            # type errors, then the scene's problems, each with file:line and a fix
svjeez frames scenes/scene.tsx --sheet   # PNG frames and a contact sheet
svjeez dev scenes/scene.tsx              # live preview with a scrubber
svjeez svg scenes/scene.tsx --out scene.svg
svjeez video scenes/scene.tsx --out scene.mp4
svjeez skill --install                   # the agent skill, into .claude/skills/svjeez
svjeez browser install                   # headless Chromium for frames, video and check --browser
```

A scene imports `svjeez` and `@svjeez/*` as usual. The binary supplies them, and supplies the JSX setup, so a lone `.tsx` file works. Its own relative imports work too. Any other package needs a `node_modules` beside the scene.

`check` type-checks the scene with the TypeScript inside the binary (strict, without `noUncheckedIndexedAccess`) before checking the scene itself. `frames`, `video` and `check --browser` use the Chromium from `svjeez browser install`, or an installed Google Chrome. Fonts from `@svjeez/fonts` download once, then come from `~/.cache/svjeez/fonts`.

## Build

```sh
bun run build:bin                                  # dist/svjeez, for this machine
bun scripts/build.ts --all                         # every target, plus svjeez-checksums.txt
bun scripts/build.ts --target bun-linux-x64        # one target
```

The build emits the packages' declaration files with `tsc` and packs them into `.build/assets.pack`, along with TypeScript 6's lib files, `@types/node` and the skill. Then it compiles `src/main.ts` with `bun build --compile`. TypeScript 6 is the one carried, because 7 is native and can't run inside the binary. A plugin embeds the files packages read beside their code: the handwriting stroke font, and the mediabunny bundle a video page loads. Mac binaries are signed again (ad hoc), which only works on a Mac. The release workflow builds every target on macOS and attaches them to the svjeez GitHub release.
