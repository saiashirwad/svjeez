import { expect, test } from "bun:test";

import type { Metrics } from "./parse.ts";
import { render, summarize, type PhaseResult, type RunResult } from "./summary.ts";

const phase = (wallMs: number, turns: number, errors: number): PhaseResult => ({
  wallMs,
  // SAFETY: the summary reads only these fields of a run's metrics.
  metrics: {
    turns,
    toolCalls: turns * 2,
    checkRuns: 1,
    frameLooks: 1,
    sourceLookups: 0,
    costUsd: 0.5,
  } as Metrics,
  grade: { built: true, errors, warnings: 1, infos: 0, codes: {}, lines: 10, sheet: "" },
});

const run = (repeat: number, build: PhaseResult, change?: PhaseResult): RunResult => ({
  task: "orrery",
  model: "haiku",
  repeat,
  dir: "d",
  build,
  change,
});

test("averages repeats into one row per task, model and phase", () => {
  const { rows } = summarize("a", [
    run(1, phase(10_000, 4, 0), phase(5_000, 2, 0)),
    run(2, phase(20_000, 8, 2)),
  ]);

  expect(rows.map((row) => row.phase)).toEqual(["build", "change"]);
  expect(rows[0]).toMatchObject({ runs: 2, built: 2, timeS: 15, turns: 6, errors: 1 });
  expect(rows[1]).toMatchObject({ runs: 1, timeS: 5 });
});

test("renders deltas against a baseline", () => {
  const now = summarize("now", [run(1, phase(10_000, 4, 0))]);
  const before = summarize("before", [run(1, phase(20_000, 6, 0))]);
  const text = render(now, before);

  expect(text).toContain("# bench now vs before");
  expect(text).toContain("10 (-10)");
  expect(text).toContain("4 (-2)");
  expect(text).toContain("0 (=)");
  expect(render(now)).not.toContain("(");
});
