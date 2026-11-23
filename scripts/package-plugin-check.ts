import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, FileSystem, Path, Predicate } from "effect";
import { ChildProcess } from "effect/process";
import { packageDirs, read } from "./package-manifest.ts";
import { run } from "./process.ts";
import * as Services from "./services.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");
  const bin = path.join(root, "packages/svjeez/node_modules/.bin");
  const dir = path.resolve();
  const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "svjeez-plugin-" });
  const self = yield* read(dir);

  const pack = (cwd: string) =>
    run(ChildProcess.make({ cwd })`npm pack --silent --pack-destination ${tmp}`).pipe(
      Effect.map((out) => path.join(tmp, out.split("\n").at(-1) ?? "")),
    );

  yield* run(ChildProcess.make({ cwd: dir, stderr: "inherit" })`bun run build:package`);
  yield* run(ChildProcess.make({ cwd: dir })`${path.join(bin, "publint")} --strict package-dist`);
  yield* Console.log("✓ publint");

  const tarball = yield* pack(path.join(dir, "package-dist"));

  const compiled = Object.entries(self.exports ?? {}).flatMap(([key, target]) =>
    Predicate.isString(target) && /\.tsx?$/.test(target) ? [key] : [],
  );

  if (compiled.length > 0) {
    yield* run(
      ChildProcess.make({
        cwd: dir,
      })`${path.join(bin, "attw")} ${tarball} --profile esm-only --entrypoints ${compiled}`,
    );

    yield* Console.log("✓ arethetypeswrong");
  }

  const manifests = new Map(
    yield* Effect.forEach(
      yield* packageDirs,
      (dir) =>
        read(dir).pipe(Effect.map((manifest) => [manifest.name, { dir, manifest }] as const)),
      {
        concurrency: "unbounded",
      },
    ),
  );

  const workspaces = (name: string): ReadonlyArray<string> =>
    Object.keys(manifests.get(name)?.manifest.dependencies ?? {})
      .filter((dependency) => dependency.startsWith("@svjeez/"))
      .flatMap((dependency) => [dependency, ...workspaces(dependency)]);

  const tarballs = [
    yield* pack(path.join(root, "packages/svjeez")),
    tarball,
    ...(yield* Effect.forEach(new Set(workspaces(self.name)), (name) => {
      const workspace = manifests.get(name)?.dir ?? "";

      return run(
        ChildProcess.make({ cwd: workspace, stderr: "inherit" })`bun run build:package`,
      ).pipe(Effect.andThen(pack(path.join(workspace, "package-dist"))));
    })),
  ];

  const consumer = path.join(tmp, "consumer");

  const { version: playwright } = yield* read(
    path.join(root, "packages/svjeez/node_modules/playwright-core"),
  );

  yield* fs.copy(path.join(dir, "test/consumer"), consumer);
  yield* run(
    ChildProcess.make({
      cwd: consumer,
    })`npx --yes npm@11 install --no-audit --no-fund --loglevel=error ${tarballs} playwright-core@${playwright}`,
  );
  yield* Console.log(`✓ installed ${tarballs.length} tarballs`);
  yield* run(ChildProcess.make({ cwd: consumer, stdout: "inherit" })`npm run --silent check`);

  yield* Console.log(
    `${self.name} package checks passed on Node ${yield* run(ChildProcess.make`node --version`)}`,
  );
}).pipe(Effect.scoped, Effect.provide(Services.layer), BunRuntime.runMain);
