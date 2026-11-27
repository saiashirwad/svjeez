import { BunRuntime } from "@effect/platform-bun";
import { Array, Console, Effect, FileSystem, Option, Path, Record } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { measurePerf } from "svjeez/frames";
import * as Services from "../../scripts/services.ts";

type Metrics = Record<
  "main" | "style" | "smil" | "paint" | "worst" | "fps" | "p95" | "dropped",
  number
>;

const combine = (
  rows: Array.NonEmptyReadonlyArray<Metrics>,
  how: (values: Array.NonEmptyReadonlyArray<number>) => number,
): Metrics => Record.map(rows[0], (_, key) => how(Array.map(rows, (row) => row[key])));

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

      const measure = Effect.fn("measure")(function* (file: string) {
        const svg = yield* fs.readFileString(file);

        const all = yield* Effect.forEach(
          Array.range(1, flags.runs),
          () =>
            Effect.tryPromise(() =>
              measurePerf(svg, { ms: flags.ms, windows: flags.windows, throttle: flags.throttle }),
            ),
          { concurrency: 1 },
        );

        const metrics = Array.map(all, (run): Metrics => ({
          main: Math.round(run.main),
          style: Math.round(run.style),
          smil: Math.round(run.smil),
          paint: Math.round(run.paint),
          worst: Math.round(run.worst * 10) / 10,
          fps: run.fps,
          p95: run.p95,
          dropped: run.dropped,
        }));

        return {
          ...combine(
            metrics,
            (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0,
          ),
          byName: all[Math.floor(flags.runs / 2)]?.events ?? {},
          running: all[0]?.animations ?? 0,
          raw: all[0]!.size.raw / 1024,
          gzip: all[0]!.size.gzip / 1024,
          brotli: all[0]!.size.brotli / 1024,
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
          const now = yield* measure(path.join(dist, `${name}.svg`));

          const was = yield* Effect.findFirst(
            Option.toArray(flags.base).map((base) => path.resolve(base, `${name}.svg`)),
            fs.exists,
          ).pipe(
            Effect.flatMap(
              Option.match({
                onNone: () => Effect.succeed(undefined),
                onSome: measure,
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
