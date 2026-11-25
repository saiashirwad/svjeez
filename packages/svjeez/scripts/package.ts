import { BunRuntime } from "@effect/platform-bun";
import { Effect, FileSystem, Path } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Exited, ScriptError } from "../../../scripts/errors";
import * as Services from "../../../scripts/services";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  yield* fs.remove("package-dist", { recursive: true, force: true });

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [
          "./src/index.ts",
          "./src/jsx-runtime.ts",
          "./src/jsx-dev-runtime.ts",
          "./src/tools.ts",
          "./src/typecheck.ts",
          "./src/frames.ts",
          "./src/page.ts",
          "./src/cli.ts",
        ],
        external: ["playwright-core"],
        root: "./src",
        outdir: "./package-dist",
        target: "node",
        splitting: true,
        throw: true,
      }),
    catch: (cause) => new ScriptError({ message: "Bundling package-dist failed.", cause }),
  });

  const code = yield* spawner.exitCode(
    ChildProcess.make({
      stdout: "inherit",
      stderr: "inherit",
    })`./node_modules/.bin/tsc -p tsconfig.package.json`,
  );

  if (code !== 0) return yield* new Exited({ code });

  yield* Effect.forEach(
    (yield* fs.glob("**/*.d.ts", { root: "package-dist" })).map((file) =>
      path.join("package-dist", file),
    ),
    (file) =>
      fs
        .readFileString(file)
        .pipe(
          Effect.flatMap((contents) =>
            fs.writeFileString(
              file,
              contents.replace(/(from\s+["'])(\.\.?\/[^"']+)(["'])/g, "$1$2.js$3"),
            ),
          ),
        ),
    { concurrency: "unbounded" },
  );

  yield* Effect.forEach(
    ["README.md", "LICENSE"],
    (file) => fs.copyFile(path.join("../..", file), file),
    {
      concurrency: "unbounded",
    },
  );
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
