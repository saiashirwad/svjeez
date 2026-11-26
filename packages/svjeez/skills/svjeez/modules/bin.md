# `@svjeez/bin`

Standalone single-file `svjeez` executable: run `check`, `frames`, `svg`, `video`, and `dev` on any `.tsx` scene with no `package.json`, no `node_modules`, and no `@jsxImportSource` pragma.

## Setup

Install via npm launcher or shell script:

```sh
npm i -g @svjeez/bin
# or
curl -fsSL https://github.com/saiashirwad/svjeez/releases/latest/download/install.sh | sh
```

Install headless Chromium once for `frames`, `video`, and `check --browser`:

```sh
svjeez browser install
```

Optionally initialize editor types and `tsconfig.json` in a folder:

```sh
svjeez init .
```

## Mental model

- **Same CLI as `svjeez`, plus `init` and `browser install`:** Commands are `svg`, `dev`, `frames`, `check`, `video`, `skill [--install]`, `version`, `init [dir] [--force]`, and `browser install`. Run `svjeez --help` for flags.
- **No pragma, no `package.json`, built-in TypeScript checking:** The binary prepends `/** @jsxImportSource svjeez */` to `.tsx`/`.jsx` files and unpacks embedded `.d.ts` files into `~/.cache/svjeez/bin/<hash>/` so `svjeez check` reports `type-error` diagnostics with zero project setup.
- **Carried modules (exact list):**
  - Included: `svjeez` (all subpaths), `@svjeez/charts`, `@svjeez/code` (`+ /palettes`), `@svjeez/diagrams`, `@svjeez/fonts` (`+ /handwriting`), `@svjeez/geo`, `@svjeez/icons` (`+ /tabler`, `/lucide`), `@svjeez/math`, `@svjeez/mermaid`, `@svjeez/video`, plus `node:*` built-ins and relative files.
  - **Not included:** `@svjeez/og`, `@svjeez/vite`, `@svjeez/astro`, `@svjeez/live`, `@svjeez/dom`. Use an npm-installed `svjeez` project for scenes that import those.
- **`svjeez init [dir]` is for editors only:** Writes `.svjeez/types` (gitignored), `tsconfig.json` with `paths`, and a starter `scene.tsx` (if none exists). `svjeez check` works without running `init`.
- **Caching:** Launcher caches the downloaded binary in `${XDG_CACHE_HOME:-~/.cache}/svjeez/bin/<version>/` (verified against `svjeez-checksums.txt`); fonts cache in `~/.cache/svjeez/fonts`.

## API map

Executable-only package (no programmatic JS exports):

| Command / env | Purpose |
|---|---|
| `svjeez init [dir] [--force]` | Write `.svjeez/types`, `tsconfig.json`, and starter `scene.tsx` for IDE type-checking |
| `svjeez browser install` | Download `chromium-headless-shell` for `frames`, `video`, and `check --browser` |
| `svjeez check\|frames\|svg\|video\|dev\|skill\|version` | Same CLI contract as the `svjeez` npm package |
| `SVJEEZ_INSTALL`, `SVJEEZ_VERSION`, `SVJEEZ_RELEASES`, `XDG_CACHE_HOME` | Install path, version pin, release mirror, and cache overrides |

## Verified snippet

Run in any empty folder with no `package.json`:

```sh
svjeez init .
svjeez check scene.tsx
svjeez frames scene.tsx --sheet --out frames
svjeez svg scene.tsx --out scene.svg
svjeez video scene.tsx --out scene.mp4
```

## Gotchas

- `compile-error: Cannot find package '@svjeez/og'` (or `@svjeez/dom`, `@svjeez/vite`, `@svjeez/astro`, `@svjeez/live`) → Those packages are not carried by the single-file binary; run the scene in an npm project with `svjeez` installed.
- Editor shows `TS2307` on `"svjeez"` while `svjeez check` passes → Run `svjeez init .` so the editor has `.svjeez/types` and `tsconfig.json`.
- `tsconfig.json is already here, so it was left alone` → Run `svjeez init --force` or merge the `paths` entries.
- `frames` / `video` / `check --browser` cannot find Chromium → Run `svjeez browser install` (or install Google Chrome).
- Binary version behind repo/npm features → Check `svjeez version` and reinstall or update `@svjeez/bin`.
