# Scene-writing skill

`svjeez skill` prints the agent skill for writing scenes, `SKILL.md`, to stdout. With `--install` it copies the whole skill, with its `references/` and `examples/`, into `<dir>/svjeez` (default `.claude/skills/svjeez`) and says where.

## Sub-features

- `skill-print` prints `SKILL.md`, starting with its `name: svjeez` frontmatter.
- `skill-install` copies `SKILL.md`, `references/` and `examples/` into `<dir>/svjeez`, overwriting an earlier copy.

## How to get to it (user POV)

- `npx svjeez skill` and `npx svjeez skill --install` in a project.

## Driving it with verify

Preconditions:

- Baseline from the README.

- **Print.** Run `$V cli skill`. Exit 0, and the output starts with `---` and `name: svjeez`.
- **Install.** Run `$V cli skill --install --dir $VERIFY_RUN/evidence/skills`. Exit 0 and `installed the svjeez skill in …/skills/svjeez`. `ls $VERIFY_RUN/evidence/skills/svjeez` lists `SKILL.md`, `examples` and `references`, and `diff -r packages/svjeez/skills/svjeez $VERIFY_RUN/evidence/skills/svjeez` prints nothing.
- **Reinstall.** Run the install again. Exit 0, same tree.
- **Proof.** The log lines and the `diff -r` result.

## Gotchas

- Without `--dir`, `--install` writes `examples/.claude/skills/svjeez` under `$V cli`. Always pass `--dir`.
- The installed examples carry their own JSX pragmas, so they compile outside this repo. Proving that takes a project with `svjeez` installed, which is outside this map.
