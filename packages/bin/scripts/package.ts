import { BunRuntime } from "@effect/platform-bun";
import { Effect, FileSystem, Path } from "effect";
import { ScriptError } from "../../../scripts/errors.ts";
import { read, writeManifest } from "../../../scripts/package-manifest.ts";
import * as Services from "../../../scripts/services.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const dir = path.resolve();
  const out = path.join(dir, "package-dist");
  const file = path.join(out, "bin/svjeez.js");
  const { version } = yield* read(dir);

  yield* fs.remove(out, { recursive: true, force: true });

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [path.join(dir, "src/svjeez.ts")],
        outdir: path.join(out, "bin"),
        target: "node",
        define: { "process.env.SVJEEZ_VERSION": JSON.stringify(version) },
        throw: true,
      }),
    catch: (cause) => new ScriptError({ message: "Bundling the launcher failed.", cause }),
  });

  yield* fs.chmod(file, 0o755);

  yield* writeManifest(dir, out, { bin: { svjeez: "./bin/svjeez.js" } });

  yield* Effect.forEach(
    ["package.json", "README.md", "LICENSE"],
    (name) => fs.chmod(path.join(out, name), 0o644),
    { concurrency: "unbounded" },
  );
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
