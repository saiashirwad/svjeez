import { expect, test } from "bun:test";

import type { Metrics } from "./parse.ts";
import { render, summarize, type PhaseResult, type RunResult } from "./summary.ts";

const phase = (wallMs: number, turns: number, errors: number, timedOut = false): PhaseResult => ({
  wallMs,
  timedOut,
  // SAFETY: the summary reads only these fields of a run's metrics.
  metrics: {
    turns,
    toolCalls: turns * 2,
    checkRuns: 1,
    frameLooks: 1,
    sourceLookups: 0,
    costUsd: 0.5,
  } as Metrics,
  grade: {
    built: true,
    errors,
    warnings: 1,
    infos: 0,
    codes: {},
    lines: 10,
    sheet: "",
    timedOut: false,
  },
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

test("marks phases that timed out in the row and the table", () => {
  const summary = summarize("t", [run(1, phase(600_000, 4, 0, true)), run(2, phase(10_000, 4, 0))]);

  expect(summary.rows[0]).toMatchObject({ runs: 2, built: 2, timedOut: 1 });
  expect(render(summary)).toContain("2/2 (1 timed out)");
  expect(render(summarize("t", [run(1, phase(10_000, 4, 0))]))).not.toContain("timed out");
});

test("lists distinct denied calls with counts at the end", () => {
  const denied = (detail: string): PhaseResult => {
    const p = phase(1000, 1, 0);

    p.metrics.denied = [{ tool: "Bash", detail }];
    p.metrics.permissionDenials = 1;

    return p;
  };

  const summary = summarize("d", [
    run(1, denied("ps aux")),
    run(2, denied("ps aux"), denied("kill 1")),
  ]);

  const text = render(summary);

  expect(summary.rows[0]?.denied).toBe(1);
  expect(summary.rows[1]?.denied).toBe(1);
  expect(text).toContain("## Denied tool calls");
  expect(text.indexOf("Bash x2: `ps aux`")).toBeLessThan(text.indexOf("Bash x1: `kill 1`"));
  expect(render(summarize("d", [run(1, phase(1000, 1, 0))]))).not.toContain("Denied");
});
