// Aggregates graded runs into per-task rows and renders them, optionally with deltas against an earlier summary.

import type { Metrics } from "./parse.ts";

export interface Grade {
  built: boolean;
  errors: number;
  warnings: number;
  infos: number;
  codes: Record<string, number>;
  lines: number;
  sheet: string;
  /** scene check or frames outlived the grading limit and was killed. */
  timedOut: boolean;
}

export interface PhaseResult {
  wallMs: number;
  /** The agent outlived its limit and was killed. */
  timedOut: boolean;
  metrics: Metrics;
  grade: Grade;
}

export interface RunResult {
  task: string;
  model: string;
  repeat: number;
  dir: string;
  build: PhaseResult;
  change?: PhaseResult;
}

export interface Row {
  task: string;
  model: string;
  phase: "build" | "change";
  runs: number;
  built: number;
  /** Phases where the agent or the grading was killed for running too long. */
  timedOut: number;
  timeS: number;
  turns: number;
  toolCalls: number;
  checkRuns: number;
  frameLooks: number;
  sourceLookups: number;
  errors: number;
  warnings: number;
  costUsd: number;
}

export interface Summary {
  label: string;
  rows: Row[];
  runs: RunResult[];
}

type Measure = Exclude<keyof Row, "task" | "model" | "phase" | "runs" | "built" | "timedOut">;

export const COLUMNS: [Measure, string][] = [
  ["timeS", "time s"],
  ["turns", "turns"],
  ["toolCalls", "tools"],
  ["checkRuns", "checks"],
  ["frameLooks", "looks"],
  ["sourceLookups", "lookups"],
  ["errors", "errors"],
  ["warnings", "warns"],
  ["costUsd", "cost $"],
];

const mean = (values: number[]): number =>
  values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

const rowOf = (task: string, model: string, phase: Row["phase"], phases: PhaseResult[]): Row => ({
  task,
  model,
  phase,
  runs: phases.length,
  built: phases.filter((p) => p.grade.built).length,
  timedOut: phases.filter((p) => p.timedOut || p.grade.timedOut).length,
  timeS: mean(phases.map((p) => p.wallMs / 1000)),
  turns: mean(phases.map((p) => p.metrics.turns)),
  toolCalls: mean(phases.map((p) => p.metrics.toolCalls)),
  checkRuns: mean(phases.map((p) => p.metrics.checkRuns)),
  frameLooks: mean(phases.map((p) => p.metrics.frameLooks)),
  sourceLookups: mean(phases.map((p) => p.metrics.sourceLookups)),
  errors: mean(phases.map((p) => p.grade.errors)),
  warnings: mean(phases.map((p) => p.grade.warnings)),
  costUsd: mean(phases.map((p) => p.metrics.costUsd)),
});

/** One row per task, model and phase, averaged over the repeats. */
export const summarize = (label: string, runs: RunResult[]): Summary => {
  const keys = [...new Set(runs.map((run) => `${run.task}\t${run.model}`))];

  const rows = keys.flatMap((key) => {
    const [task = "", model = ""] = key.split("\t");
    const same = runs.filter((run) => run.task === task && run.model === model);
    const changes = same.flatMap((run) => (run.change ? [run.change] : []));

    return [
      rowOf(
        task,
        model,
        "build",
        same.map((run) => run.build),
      ),
      ...(changes.length > 0 ? [rowOf(task, model, "change", changes)] : []),
    ];
  });

  return { label, rows, runs };
};

const num = (value: number, digits: number): string => value.toFixed(digits).replace(/\.0+$/, "");

const cell = (value: number, base: number | undefined, digits: number): string => {
  if (base === undefined) return num(value, digits);

  const delta = value - base;
  const shown = num(Math.abs(delta), digits);

  return shown === "0"
    ? `${num(value, digits)} (=)`
    : `${num(value, digits)} (${delta < 0 ? "-" : "+"}${shown})`;
};

const sameRow = (a: Row, b: Row): boolean =>
  a.task === b.task && a.model === b.model && a.phase === b.phase;

const built = (row: Row): string =>
  `${row.built}/${row.runs}${row.timedOut > 0 ? ` (${row.timedOut} timed out)` : ""}`;

export const render = (summary: Summary, baseline?: Summary): string => {
  const head = ["task", "model", "n", "built", ...COLUMNS.map(([, title]) => title)];

  const lines = summary.rows.map((row) => {
    const base = baseline?.rows.find((other) => sameRow(row, other));

    const measures = COLUMNS.map(([key]) =>
      cell(row[key], base?.[key], key === "costUsd" ? 3 : key === "timeS" ? 0 : 1),
    );

    const name = row.phase === "change" ? `${row.task} (change)` : row.task;

    return [name, row.model, String(row.runs), built(row), ...measures];
  });

  const table = [head, head.map(() => "---"), ...lines].map((cells) => `| ${cells.join(" | ")} |`);
  const versus = baseline ? ` vs ${baseline.label}` : "";

  return `# bench ${summary.label}${versus}\n\n${table.join("\n")}\n`;
};
