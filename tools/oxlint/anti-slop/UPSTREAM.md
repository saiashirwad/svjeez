# Provenance

- Source: https://github.com/dmmulroy/anti-slop
- Revision: `63dbb09`, checked 2026-11-23 (rules unchanged from `13909c9`)
- Installed: 2026-10-29 from `skills/install-anti-slop/assets/anti-slop`
- Entry point: `tools/oxlint/anti-slop/index.ts`
- Effect entry point: `tools/oxlint/anti-slop/effect/index.ts`, registered; its rules run only in the code that uses Effect (see `overrides` in `.oxlintrc.json`)
- `no-shape-in-symbol-names` is off: `Shape` is the name of svjeez's own component

This repository vendors the plugin and owns its rules. The copied files match the
upstream skill assets at that revision. Local changes belong here with the rules.
The `vendor/eslint-stylistic` license and provenance ship with
`require-readable-spacing`.
