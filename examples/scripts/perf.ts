import { BunRuntime } from "@effect/platform-bun";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";
import { Array, Console, Effect, FileSystem, Option, Path, Record, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { ChildProcess } from "effect/process";
import { chromium } from "playwright-core";
import { costOf } from "svjeez/frames";
import { ScriptError } from "../../scripts/errors.ts";
import { run } from "../../scripts/process.ts";
import * as Services from "../../scripts/services.ts";

type Metrics = Record<
  "main" | "style" | "smil" | "paint" | "worst" | "fps" | "p95" | "dropped",
  number
>;

const combine = (
  rows: Array.NonEmptyReadonlyArray<Metrics>,
  how: (values: Array.NonEmptyReadonlyArray<number>) => number,
): Metrics => Record.map(rows[0], (_, key) => how(Array.map(rows, (row) => row[key])));

const mean = (values: ReadonlyArray<number>) => values.reduce((a, b) => a + b, 0) / values.length;

const total = (events: ReadonlyArray<{ readonly dur: number }>) =>
  events.reduce((sum, event) => sum + event.dur, 0);

const delta = (now: number, was: number | undefined, unit = "") =>
  was === undefined || Math.abs(now - was) < 0.05 * Math.max(1, was)
    ? `${Math.round(now)}${unit}`
    : `${Math.round(now)}${unit} (${now < was ? "" : "+"}${Math.round(((now - was) / Math.max(was, 1e-9)) * 100)}%)`;

const change = (now: number, was: number | undefined, digits = 0) =>
  was === undefined ? now.toFixed(digits) : `${was.toFixed(digits)} → ${now.toFixed(digits)}`;

Effect.gen(function* () {
  const path = yield* Path.Path;

  return yield* Command.make(
    "perf",
    {
      names: Argument.String("example").pipe(Argument.variadic()),
      all: Flag.Boolean("all").pipe(Flag.withDefault(false)),
      events: Flag.Boolean("events").pipe(Flag.withDefault(false)),
      ms: Flag.Int("ms").pipe(Flag.withDefault(3000)),
      runs: Flag.Int("runs").pipe(Flag.withDefault(1)),
      windows: Flag.Int("windows").pipe(Flag.withDefault(4)),
      throttle: Flag.Finite("throttle").pipe(Flag.withDefault(1)),
      base: Flag.String("base").pipe(Flag.optional),
      dist: Flag.String("dist").pipe(
        Flag.withDefault(path.join(import.meta.dirname, "..", "dist")),
      ),
    },
    Effect.fn(function* (flags) {
      const fs = yield* FileSystem.FileSystem;
      const dist = path.resolve(flags.dist);
      const work = yield* fs.makeTempDirectoryScoped({ prefix: "svjeez-perf-" });
      const session = path.basename(work);

      const browse = (...args: ReadonlyArray<string>) =>
        run(ChildProcess.make`agent-browser --session ${session} --allow-file-access ${args}`);

      yield* fs.copyFile(
        path.join(import.meta.dirname, "perf-page.html"),
        path.join(work, "bench.html"),
      );

      const measure = Effect.fn("measure")(function* (file: string, tag: string) {
        const all = yield* Effect.forEach(
          Array.range(1, flags.runs),
          () =>
            Effect.gen(function* () {
              const copy = path.join(work, `${tag}-${path.basename(file)}`);

              yield* fs.copyFile(file, copy);
              yield* browse(
                "open",
                `file://${path.join(work, "bench.html")}?svg=${path.basename(copy)}`,
              );
              yield* browse("eval", "ready");

              if (flags.throttle > 1) {
                const browser = yield* Effect.acquireRelease(
                  browse("get", "cdp-url").pipe(
                    Effect.flatMap((url) => Effect.tryPromise(() => chromium.connectOverCDP(url))),
                  ),
                  (browser) => Effect.promise(() => browser.close()),
                );

                const page = yield* Effect.fromOption(
                  Array.findFirst(
                    browser.contexts().flatMap((context) => context.pages()),
                    (page) => page.url().includes("bench.html"),
                  ),
                  () =>
                    new ScriptError({ message: `agent-browser has no page open on "bench.html".` }),
                );

                const cdp = yield* Effect.tryPromise(() => page.context().newCDPSession(page));

                const spins = Effect.tryPromise(() => page.evaluate("spin()")).pipe(
                  Effect.map(Number),
                );

                const before = yield* spins;

                yield* Effect.tryPromise(() =>
                  cdp.send("Emulation.setCPUThrottlingRate", { rate: flags.throttle }),
                );

                const slowed = before / (yield* spins);

                if (slowed < flags.throttle * 0.5)
                  return yield* new ScriptError({
                    message: `CPU throttling ${flags.throttle}x did not take effect (${slowed.toFixed(1)}x).`,
                  });
              }

              const parts = yield* Effect.forEach(
                Array.range(0, flags.windows - 1),
                (k) =>
                  Effect.gen(function* () {
                    const trace = path.join(work, `${tag}-${k}-${path.basename(file)}.json`);

                    yield* browse("eval", `from(${k / flags.windows})`);
                    yield* browse("eval", "frames()");
                    yield* browse(
                      "profiler",
                      "start",
                      "--categories",
                      "devtools.timeline,blink,toplevel,disabled-by-default-devtools.timeline",
                    );
                    yield* browse("wait", String(flags.ms));
                    yield* browse("profiler", "stop", trace);

                    const frames = yield* browse("eval", "frames()").pipe(
                      Effect.flatMap(
                        Schema.decodeEffect(
                          Schema.fromJsonString(
                            Schema.fromJsonString(
                              Schema.Struct({
                                fps: Schema.Number,
                                p95: Schema.Number,
                                dropped: Schema.Number,
                              }),
                            ),
                          ),
                        ),
                      ),
                    );

                    const Events = Schema.Array(
                      Schema.Struct({
                        ph: Schema.optionalKey(Schema.String),
                        name: Schema.String,
                        pid: Schema.Number,
                        tid: Schema.Number,
                        ts: Schema.Number,
                        dur: Schema.optionalKey(Schema.Number),
                        args: Schema.optionalKey(
                          Schema.Struct({ name: Schema.optionalKey(Schema.String) }),
                        ),
                      }),
                    );

                    const parsed = yield* fs
                      .readFileString(trace)
                      .pipe(
                        Effect.flatMap(
                          Schema.decodeEffect(
                            Schema.fromJsonString(
                              Schema.Union([Events, Schema.Struct({ traceEvents: Events })]),
                            ),
                          ),
                        ),
                      );

                    const events = "traceEvents" in parsed ? parsed.traceEvents : parsed;

                    const renderers = new Set(
                      events.flatMap((e) =>
                        e.ph === "M" &&
                        e.name === "thread_name" &&
                        e.args?.name === "CrRendererMain"
                          ? [`${e.pid}:${e.tid}`]
                          : [],
                      ),
                    );

                    const [main = []] = Object.entries(
                      Array.groupBy(
                        events.flatMap((e) => (e.dur ? [{ ...e, dur: e.dur }] : [])),
                        (e) => `${e.pid}:${e.tid}`,
                      ),
                    )
                      .flatMap(([thread, timed]) => (renderers.has(thread) ? [timed] : []))
                      .sort((a, b) => total(b) - total(a));

                    const seconds =
                      (main.reduce((last, e) => Math.max(last, e.ts + e.dur), 0) -
                        main.reduce((first, e) => Math.min(first, e.ts), Infinity)) /
                      1e6;

                    const tasks = ["ThreadControllerImpl::RunTask", "RunTask"];

                    const byName = Record.map(
                      Array.groupBy(
                        main.filter((e) => !tasks.includes(e.name)),
                        (e) => e.name,
                      ),
                      (events) => total(events) / 1000 / seconds,
                    );

                    const running = main.filter((e) => tasks.includes(e.name));

                    return {
                      metrics: {
                        main: Math.round(total(running) / 1000 / seconds),
                        style: Math.round(byName["UpdateLayoutTree"] ?? 0),
                        smil: Math.round(byName["PageAnimator::serviceScriptedAnimations"] ?? 0),
                        paint: Math.round(byName["Paint"] ?? 0),
                        worst: Math.round(Math.max(0, ...running.map((e) => e.dur)) / 100) / 10,
                        ...frames,
                        dropped: frames.dropped * 100,
                      },
                      byName,
                    };
                  }),
                { concurrency: 1 },
              );

              const metrics = Array.map(parts, (part) => part.metrics);
              const peak = combine(metrics, (values) => Math.max(...values));

              return {
                metrics: { ...combine(metrics, mean), worst: peak.worst, p95: peak.p95 },
                byName: Record.map(
                  Object.assign({}, ...parts.map((part) => part.byName)),
                  (_, name) => mean(parts.map((part) => part.byName[name] ?? 0)),
                ),
              };
            }).pipe(Effect.scoped),
          { concurrency: 1 },
        );

        const bytes = yield* fs.readFile(file);

        return {
          ...combine(
            Array.map(all, (run) => run.metrics),
            (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0,
          ),
          byName: all[Math.floor(flags.runs / 2)]?.byName ?? {},
          running: Object.values(costOf(new TextDecoder().decode(bytes))).reduce(
            (a, b) => a + b,
            0,
          ),
          raw: bytes.length / 1024,
          gzip: gzipSync(bytes).length / 1024,
          brotli:
            brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length /
            1024,
        };
      });

      const names = flags.all
        ? [
            ...flags.names,
            ...(yield* fs.glob("**/*.svg", { root: dist })).map((file) =>
              file.slice(0, -".svg".length),
            ),
          ]
        : flags.names.length > 0
          ? flags.names
          : ["hype"];

      const rows = yield* Effect.forEach(
        names,
        Effect.fn(function* (name) {
          const now = yield* measure(path.join(dist, `${name}.svg`), "now");

          const was = yield* Effect.findFirst(
            Option.toArray(flags.base).map((base) => path.resolve(base, `${name}.svg`)),
            fs.exists,
          ).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeed(undefined),
                onSome: (file) => measure(file, "base"),
              }),
            ),
          );

          yield* Console.error(`measured ${name}`);

          if (flags.events)
            yield* Console.error(
              Object.entries(now.byName)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([event, perSecond]) => `  ${event.padEnd(40)} ${perSecond.toFixed(1)} ms/s`)
                .join("\n"),
            );

          return [
            name,
            change(now.running, was?.running, 1).replace(/\.0\b/g, ""),
            ...(["raw", "gzip", "brotli"] as const).map((key) => delta(now[key], was?.[key], "K")),
            ...(["main", "style", "smil", "paint"] as const).map((key) =>
              delta(now[key], was?.[key]),
            ),
            change(now.worst, was?.worst, 1),
            change(now.fps, was?.fps),
            change(now.p95, was?.p95),
            change(now.dropped, was?.dropped),
          ];
        }),
        { concurrency: 1 },
      ).pipe(
        Effect.ensuring(
          run(ChildProcess.make`agent-browser --session ${session} close`).pipe(Effect.ignore),
        ),
      );

      const table = [
        [
          "svg",
          "anims/frame",
          "raw",
          "gzip",
          "brotli",
          "main ms/s",
          "style",
          "smil",
          "paint",
          "worst task ms",
          "fps",
          "p95 ms",
          "dropped %",
        ],
        ...rows,
      ];

      yield* Effect.forEach(table, (row) =>
        Console.log(
          row
            .map((cell, i) => {
              const width = Math.max(...table.map((row) => row[i]?.length ?? 0));

              return i === 0 ? cell.padEnd(width) : cell.padStart(width);
            })
            .join("  "),
        ),
      );
    }, Effect.scoped),
  ).pipe(Command.run({ version: "internal" }));
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
