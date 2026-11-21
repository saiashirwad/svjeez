// Agent benchmark: bun run bench [--model sonnet,haiku] [--tasks orrery,...] [--repeat n] [--concurrency n] [--label name] [--compare dir|json] [--agent-timeout s] [--grade-timeout s]
// Runs a headless Claude Code agent per task x model x repeat, grades each scene mechanically and writes bench/results/<label>/.

import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

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

/** Seconds a process may run before it is killed. */
interface Limits {
  agentS: number;
  gradeS: number;
}

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
  limits: Limits;
}

const parseArgs = (argv: string[]): Options => {
  const flags = new Map<string, string>();

  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i] ?? "";
    const value = argv[i + 1];

    if (!flag.startsWith("--") || value === undefined)
      throw new Error(
        `usage: bun run bench [--model a,b] [--tasks a,b] [--repeat n] [--concurrency n] [--label name] [--compare dir|json] [--agent-timeout s] [--grade-timeout s]\n(bad argument: ${flag})`,
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
    limits: {
      agentS: Number(flags.get("agent-timeout") ?? 600),
      gradeS: Number(flags.get("grade-timeout") ?? 120),
    },
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

const killTree = (pid: number): void => {
  const children = Bun.spawnSync(["pgrep", "-P", String(pid)])
    .stdout.toString()
    .split("\n");

  for (const child of children) if (child !== "") killTree(Number(child));

  try {
    process.kill(pid, "SIGKILL");
  } catch {
    // Already gone.
  }
};

interface Finished {
  stdout: string;
  stderr: string;
  code: number | null;
  timedOut: boolean;
}

/** Runs a command, killing it and its children when it outlives the limit. */
const runLimited = async (
  cmd: string[],
  options: { cwd: string; env?: Record<string, string | undefined> },
  limitS: number,
): Promise<Finished> => {
  const proc = Bun.spawn(cmd, { ...options, stdin: "ignore", stdout: "pipe", stderr: "pipe" });
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    killTree(proc.pid);
  }, limitS * 1000);

  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  clearTimeout(timer);

  return { stdout, stderr, code, timedOut };
};

const spawnAgent = async (
  prompt: string,
  model: string,
  dir: string,
  streamFile: string,
  limitS: number,
): Promise<{ wallMs: number; timedOut: boolean }> => {
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

  const { stdout, stderr, timedOut } = await runLimited(
    ["claude", ...args],
    {
      cwd: ROOT,
      // The user's global CLAUDE.md is read regardless of --setting-sources; these keep it and auto-memory out.
      env: {
        ...process.env,
        CLAUDE_CODE_DISABLE_CLAUDE_MDS: "1",
        CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1",
      },
    },
    limitS,
  );

  await writeFile(streamFile, stdout);

  if (stderr.trim()) await writeFile(`${streamFile}.stderr`, stderr);

  return { wallMs: Date.now() - started, timedOut };
};

const sceneCli = async (
  args: string[],
  limitS: number,
): Promise<{ stdout: string; timedOut: boolean }> => {
  const { stdout, timedOut } = await runLimited(
    ["bun", "--silent", "run", "scene", ...args],
    { cwd: ROOT },
    limitS,
  );

  return { stdout, timedOut };
};

interface CheckProblem {
  code: string;
  severity: "error" | "warning" | "info";
}

interface CheckReport {
  scene?: object;
  problems?: CheckProblem[];
}

const grade = async (dir: string, framesDir: string, limitS: number): Promise<Grade> => {
  const file = join(ROOT, dir, "index.tsx");
  const source = existsSync(file) ? await readFile(file, "utf8") : "";
  const { stdout, timedOut: checkTimedOut } = await sceneCli(["check", file, "--json"], limitS);
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

  const frames = built
    ? await sceneCli(["frames", file, "--sheet", "--out", framesDir], limitS)
    : undefined;

  return {
    built,
    errors: count("error") + (start < 0 ? 1 : 0),
    warnings: count("warning"),
    infos: count("info"),
    codes,
    lines: source === "" ? 0 : source.trimEnd().split("\n").length,
    sheet: existsSync(sheet) ? relative(ROOT, sheet) : "",
    timedOut: checkTimedOut || frames?.timedOut === true,
  };
};

const phase = async (
  name: string,
  prompt: string,
  model: string,
  dir: string,
  out: string,
  limits: Limits,
): Promise<PhaseResult> => {
  const { wallMs, timedOut } = await spawnAgent(
    prompt,
    model,
    dir,
    join(out, `${name}.jsonl`),
    limits.agentS,
  );

  const ctx: RunContext = { root: ROOT, dir };
  const m = metrics(parseStream(await readFile(join(out, `${name}.jsonl`), "utf8")), ctx);

  return {
    wallMs,
    timedOut,
    metrics: m,
    grade: await grade(
      dir,
      join(out, name === "build" ? "frames" : `frames-${name}`),
      limits.gradeS,
    ),
  };
};

const runOne = async (
  task: Task,
  model: string,
  repeat: number,
  label: string,
  templates: [string, string],
  limits: Limits,
): Promise<RunResult> => {
  const run = `${task.name}-${model.replace(/[^\w.-]+/g, "-")}-${repeat}`;
  const dir = `examples/bench/${label}/${run}`;
  const out = join(BENCH, "results", label, run);

  await mkdir(join(ROOT, dir), { recursive: true });
  await mkdir(out, { recursive: true });

  const values = { dir, task: task.name, spec: task.spec, change: task.change ?? "" };
  const build = await phase("build", fill(templates[0], values), model, dir, out, limits);
  let change: PhaseResult | undefined;

  if (task.change !== undefined) {
    // The follow-up agent edits the scene in place; keep the first version beside it.
    const file = join(ROOT, dir, "index.tsx");

    if (existsSync(file)) await Bun.write(join(ROOT, dir, "index.build.tsx"), Bun.file(file));

    change = await phase("change", fill(templates[1], values), model, dir, out, limits);
  }

  const result: RunResult = { task: task.name, model, repeat, dir, build, change };

  await writeFile(join(out, `../${run}.json`), JSON.stringify(result, null, 2));
  const denied = build.metrics.permissionDenials + (change?.metrics.permissionDenials ?? 0);

  if (denied > 0) console.log(`warning: ${run} had ${denied} denied tool calls`);

  const timedOut = [build, change].some((p) => p?.timedOut === true || p?.grade.timedOut === true);

  console.log(
    `done ${run}: ${(build.wallMs / 1000).toFixed(0)}s, ${build.metrics.turns} turns, built=${build.grade.built}${timedOut ? " (timed out)" : ""}`,
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
        (_, i) => () => runOne(task, model, i + 1, options.label, templates, options.limits),
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
