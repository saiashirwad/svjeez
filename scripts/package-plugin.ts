import { BunRuntime } from "@effect/platform-bun";
import { Effect, FileSystem, Path, Predicate, Record, Schema } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Exited } from "./errors.ts";
import { read, writeManifest } from "./package-manifest.ts";
import * as Services from "./services.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const dir = path.resolve();
  const out = path.join(dir, "package-dist");

  const copy = (from: string, to: string) =>
    fs
      .makeDirectory(path.dirname(path.join(out, to)), { recursive: true })
      .pipe(Effect.andThen(fs.copyFile(path.join(dir, from), path.join(out, to))));

  yield* fs.remove(out, { recursive: true, force: true });

  const code = yield* spawner.exitCode(
    ChildProcess.make({
      stdout: "inherit",
      stderr: "inherit",
    })`${path.join(dir, "node_modules/.bin/tsc")} -p tsconfig.package.json`,
  );

  if (code !== 0) return yield* new Exited({ code });

  yield* Effect.forEach(
    (yield* fs.glob("**/*.js", { root: out })).map((file) => path.join(out, file)),
    (file) =>
      fs
        .readFileString(file)
        .pipe(
          Effect.flatMap((contents) =>
            fs.writeFileString(
              file,
              contents.replaceAll(
                /new URL\((["'])(\.{1,2}\/[^"']+)\.ts\1, import\.meta\.url\)/g,
                "new URL($1$2.js$1, import.meta.url)",
              ),
            ),
          ),
        ),
    { concurrency: "unbounded" },
  );

  const exports = yield* Schema.decodeUnknownEffect(
    Schema.Record(
      Schema.String,
      Schema.Union([Schema.String, Schema.Struct({ types: Schema.String })]),
    ),
  )((yield* read(dir)).exports ?? {});

  yield* writeManifest(dir, out, {
    exports: yield* Effect.all(
      Record.map(exports, (target) => {
        if (!Predicate.isString(target))
          return copy(target.types, target.types).pipe(Effect.as(target));

        const file = target.replace(/^\.\/src\//, "./");

        return /\.tsx?$/.test(file)
          ? Effect.succeed({
              types: file.replace(/\.tsx?$/, ".d.ts"),
              default: file.replace(/\.tsx?$/, ".js"),
            })
          : copy(target, file).pipe(Effect.as(file));
      }),
      { concurrency: "unbounded" },
    ),
  });
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
