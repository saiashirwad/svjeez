# Agent benchmark

Measures how fast and how well a headless Claude Code agent builds svjeez scenes, so changes to the API, the skill or the tooling can be compared run over run.

## Run

```sh
bun run bench --tasks orrery --model haiku --label smoke
bun run bench --model sonnet,opus --repeat 3 --label before-x
bun run bench --model sonnet --repeat 3 --label after-x --compare before-x
```

Flags: `--model a,b` (default sonnet), `--tasks a,b` (default all of `bench/tasks/`), `--repeat n` (1), `--concurrency n` (4), `--label name` (timestamp), `--compare <results dir, label or baseline json>`, `--agent-timeout s` (600), `--grade-timeout s` (120).

A process that outlives its timeout is killed with its children and recorded as timed out (`timedOut` on the phase and its grade, "(n timed out)" in the built column), so one pathological scene cannot stall the suite. A timed-out agent is still graded on what it wrote; a timed-out `scene check` counts as not built.

Each task x model x repeat gets `examples/bench/<label>/<task>-<model>-<i>/`. A fresh agent builds the scene from `prompt.md`; tasks with a `## Change` section then get a second fresh agent running `change-prompt.md` on the result (the first version stays as `index.build.tsx`). Both are graded.

## How the agent runs

`claude -p` from the repo root with `--output-format stream-json --verbose --strict-mcp-config --no-session-persistence`, plus:

- `--setting-sources project`: no user settings, hooks or user skills; the repo's `.claude/` still applies.
- `CLAUDE_CODE_DISABLE_CLAUDE_MDS=1` and `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`: `--setting-sources` does not stop the user's global CLAUDE.md or memory from loading, these do. (`--bare` would too, but it drops OAuth login.)
- `--permission-mode dontAsk --permission-prompts none`: anything not allowed is denied, never asked.
- Allowed: Read, Glob, Grep, Write and Edit inside the run's directory, Bash for bun, bunx, ls, cat, head, tail, wc, find, grep, rg. A denied call shows as a tool error and in `permissionDenials`.

## Results

`bench/results/<label>/` (gitignored): `summary.md`, `summary.json`, `<run>.json` (metrics and grade per phase), `<run>/build.jsonl` and `change.jsonl` (raw streams), `<run>/frames/sheet.png` (`frames-change/` after the change). Copy a summary worth comparing against into `bench/baselines/` and commit it.

## Metrics

- time: wall seconds for the agent process. turns, cost: from the stream's result event.
- tools: all tool calls (`tools` in the json splits them by tool); tool errors counts failed results, including denials.
- checks: runs of `scene check`. frame and svg runs are in the json.
- looks: Reads of a PNG (frame looks).
- lookups: reads, greps and shell reads of library source or other examples outside the run's own directory. The skill, `examples/theme.ts` and `examples/fonts/` do not count. Few lookups means the skill was enough.
- errors, warnings: `scene check --json` on the final scene (type errors and compile errors count as errors; built = it compiled). The json also has info counts, problem codes and the scene's line count.

With repeats, rows are means. With `--compare`, each cell shows `value (delta)` against the matching task, model and phase.

## Tests

`cd bench && bun test` (also part of `bun run test`). `fixtures/trivial.jsonl` is a trimmed real haiku stream; to re-record, run `claude -p ... --output-format stream-json --verbose` with a few tool calls and strip the thinking text, signatures and long results.
