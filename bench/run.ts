// Agent benchmark: bun run bench [--model sonnet,haiku] [--tasks orrery,...] [--repeat n] [--concurrency n] [--label name] [--compare dir|json]
// Runs a headless Claude Code agent per task x model x repeat, grades each scene mechanically and writes bench/results/<label>/.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { metrics, parseStream, type RunContext } from "./parse.ts";
import {
  render,
  summarize,
  type Grade,
  type PhaseResult,
  type RunResult,
  type Summary,
} from "./summary.ts";

const ROOT = resolve(import.meta.dir, "..");
const BENCH = join(ROOT, "bench");
const AGENT_TIMEOUT_MS = 20 * 60_000;
const GRADE_TIMEOUT_MS = 3 * 60_000;

interface Task {
  name: string;
  spec: string;
  change?: string;
}

interface Options {
  models: string[];
  tasks: string[];
  repeat: number;
  concurrency: number;
  label: string;
  compare?: string;
}

const parseArgs = (argv: string[]): Options => {
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];

    if (!flag.startsWith("--") || value === undefined)
      throw new Error(
        `usage: bun run bench [--model a,b] [--tasks a,b] [--repeat n] [--concurrency n] [--label name] [--compare dir|json]\n(bad argument: ${flag})`,
      );

    flags.set(flag.slice(2), value);
  }

  const list = (name: string, fallback: string[]): string[] =>
    flags.get(name)?.split(",").filter(Boolean) ?? fallback;

  return {
    models: list("model", ["sonnet"]),
    tasks: list("tasks", []),
    repeat: Number(flags.get("repeat") ?? 1),
    concurrency: Number(flags.get("concurrency") ?? 4),
    label: flags.get("label") ?? new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19),
    compare: flags.get("compare"),
  };
};

const loadTasks = async (wanted: string[]): Promise<Task[]> => {
  const files = (await readdir(join(BENCH, "tasks"))).filter((file) => file.endsWith(".md")).sort();

  const tasks = await Promise.all(
    files.map(async (file): Promise<Task> => {
      const text = await readFile(join(BENCH, "tasks", file), "utf8");
      const [body = "", change] = text.split(/^## Change\s*$/m);

      return {
        name: file.replace(/\.md$/, ""),
        spec: body.replace(/^# .*$/m, "").trim(),
        change: change?.trim() || undefined,
      };
    }),
  );

  const missing = wanted.filter((name) => !tasks.some((task) => task.name === name));

  if (missing.length > 0)
    throw new Error(
      `unknown tasks: ${missing.join(", ")} (have ${tasks.map((t) => t.name).join(", ")})`,
    );

  return wanted.length > 0 ? tasks.filter((task) => wanted.includes(task.name)) : tasks;
};

const fill = (template: string, values: Record<string, string>): string =>
  template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");

// Read-only Bash plus bun for the svjeez CLI. Writes are confined to the run's own directory.
const allowedTools = (dir: string): string[] => [
  "Read",
  "Glob",
  "Grep",
  `Write(${dir}/**)`,
  `Edit(${dir}/**)`,
  ...["bun", "bunx", "ls", "cat", "head", "tail", "wc", "find", "grep", "rg"].flatMap((cmd) => [
    `Bash(${cmd})`,
    `Bash(${cmd} *)`,
  ]),
];

const spawnAgent = async (
  prompt: string,
  model: string,
  dir: string,
  streamFile: string,
): Promise<number> => {
  const args = [
    "-p",
    prompt,
    "--model",
    model,
    "--output-format",
    "stream-json",
    "--verbose",
    "--strict-mcp-config",
    "--no-session-persistence",
    // Project settings and skills only: no user settings, hooks or user-level skills.
    "--setting-sources",
    "project",
    // Never prompt: whatever is not in the allow list is denied.
    "--permission-mode",
    "dontAsk",
    "--permission-prompts",
    "none",
    "--allowedTools",
    ...allowedTools(dir),
  ];

  const started = Date.now();

  const proc = Bun.spawn(["claude", ...args], {
    cwd: ROOT,
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
    // The user's global CLAUDE.md is read regardless of --setting-sources; these keep it and auto-memory out.
    env: {
      ...process.env,
      CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
      CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
    },
  });

  const timer = setTimeout(() => proc.kill(), AGENT_TIMEOUT_MS);

  const [out, err] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  clearTimeout(timer);
  await writeFile(streamFile, out);

  if (err.trim()) await writeFile(`${streamFile}.stderr`, err);

  return Date.now() - started;
};

const sceneCli = async (args: string[]): Promise<{ stdout: string; code: number }> => {
  const proc = Bun.spawn(["bun", "--silent", "run", "scene", ...args], {
    cwd: ROOT,
    stdout: "pipe",
    stderr: "pipe",
  });

  const timer = setTimeout(() => proc.kill(), GRADE_TIMEOUT_MS);

  const [stdout, code] = await Promise.all([
    new Response(proc.stdout).text(),
    proc.exited,
    new Response(proc.stderr).text(),
  ]);

  clearTimeout(timer);

  return { stdout, code };
};

interface CheckProblem {
  code: string;
  severity: "error" | "warning" | "info";
}

interface CheckReport {
  scene?: object;
  problems?: CheckProblem[];
}

const grade = async (dir: string, framesDir: string): Promise<Grade> => {
  const file = join(ROOT, dir, "index.tsx");
  const source = existsSync(file) ? await readFile(file, "utf8") : "";
  const { stdout } = await sceneCli(["check", file, "--json"]);
  const start = stdout.indexOf("{");
  let report: CheckReport = {};

  try {
    report = JSON.parse(stdout.slice(start));
  } catch {
    // No JSON: the CLI failed before it could report, which counts as not built.
  }

  const problems = report.problems ?? [];
  const codes: Record<string, number> = {};

  for (const problem of problems) codes[problem.code] = (codes[problem.code] ?? 0) + 1;

  const count = (severity: CheckProblem["severity"]): number =>
    problems.filter((p) => p.severity === severity).length;

  const built = report.scene !== undefined && !codes["compile-error"];
  const sheet = join(framesDir, "sheet.png");

  if (built) await sceneCli(["frames", file, "--sheet", "--out", framesDir]);

  return {
    built,
    errors: count("error") + (start < 0 ? 1 : 0),
    warnings: count("warning"),
    infos: count("info"),
    codes,
    lines: source === "" ? 0 : source.trimEnd().split("\n").length,
    sheet: existsSync(sheet) ? sheet : "",
  };
};

const phase = async (
  name: string,
  prompt: string,
  model: string,
  dir: string,
  out: string,
): Promise<PhaseResult> => {
  const wallMs = await spawnAgent(prompt, model, dir, join(out, `${name}.jsonl`));
  const ctx: RunContext = { root: ROOT, dir };
  const m = metrics(parseStream(await readFile(join(out, `${name}.jsonl`), "utf8")), ctx);

  return {
    wallMs,
    metrics: m,
    grade: await grade(dir, join(out, name === "build" ? "frames" : `frames-${name}`)),
  };
};

const runOne = async (
  task: Task,
  model: string,
  repeat: number,
  label: string,
  templates: [string, string],
): Promise<RunResult> => {
  const run = `${task.name}-${model.replace(/[^\w.-]+/g, "-")}-${repeat}`;
  const dir = `examples/bench/${label}/${run}`;
  const out = join(BENCH, "results", label, run);

  await mkdir(join(ROOT, dir), { recursive: true });
  await mkdir(out, { recursive: true });

  const values = { dir, task: task.name, spec: task.spec, change: task.change ?? "" };
  const build = await phase("build", fill(templates[0], values), model, dir, out);
  let change: PhaseResult | undefined;

  if (task.change !== undefined) {
    // The follow-up agent edits the scene in place; keep the first version beside it.
    const file = join(ROOT, dir, "index.tsx");

    if (existsSync(file)) await Bun.write(join(ROOT, dir, "index.build.tsx"), Bun.file(file));

    change = await phase("change", fill(templates[1], values), model, dir, out);
  }

  const result: RunResult = { task: task.name, model, repeat, dir, build, change };

  await writeFile(join(out, `../${run}.json`), JSON.stringify(result, null, 2));
  console.log(
    `done ${run}: ${(build.wallMs / 1000).toFixed(0)}s, ${build.metrics.turns} turns, built=${build.grade.built}`,
  );

  return result;
};

const loadSummary = async (arg: string): Promise<Summary> => {
  const candidates = [
    resolve(arg),
    join(BENCH, "results", arg),
    join(BENCH, "baselines", arg),
    join(BENCH, "baselines", `${arg}.json`),
  ];

  for (const candidate of candidates)
    for (const file of [candidate, join(candidate, "summary.json")])
      if (file.endsWith(".json") && existsSync(file))
        return JSON.parse(await readFile(file, "utf8"));

  throw new Error(`no summary to compare with: ${arg}`);
};

const main = async (): Promise<void> => {
  const options = parseArgs(process.argv.slice(2));
  const tasks = await loadTasks(options.tasks);
  const baseline = options.compare ? await loadSummary(options.compare) : undefined;

  const templates: [string, string] = [
    await readFile(join(BENCH, "prompt.md"), "utf8"),
    await readFile(join(BENCH, "change-prompt.md"), "utf8"),
  ];

  const jobs = tasks.flatMap((task) =>
    options.models.flatMap((model) =>
      Array.from(
        { length: options.repeat },
        (_, i) => () => runOne(task, model, i + 1, options.label, templates),
      ),
    ),
  );

  const results: RunResult[] = [];

  const workers = Array.from({ length: Math.min(options.concurrency, jobs.length) }, async () => {
    for (let job = jobs.shift(); job !== undefined; job = jobs.shift()) results.push(await job());
  });

  await Promise.all(workers);
  results.sort(
    (a, b) => a.task.localeCompare(b.task) || a.model.localeCompare(b.model) || a.repeat - b.repeat,
  );

  const summary = summarize(options.label, results);
  const out = join(BENCH, "results", options.label);

  await writeFile(join(out, "summary.json"), JSON.stringify(summary, null, 2));
  await writeFile(join(out, "summary.md"), render(summary, baseline));
  console.log(`\n${render(summary, baseline)}\nresults: ${out}`);
};

await main();
