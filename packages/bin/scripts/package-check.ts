import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, FileSystem, Path } from "effect";
import { Digest } from "effect/crypto";
import { ChildProcess } from "effect/process";
import { ScriptError } from "../../../scripts/errors.ts";
import { read } from "../../../scripts/package-manifest.ts";
import { run } from "../../../scripts/process.ts";
import * as Services from "../../../scripts/services.ts";
import { TARGETS } from "./binary.ts";
import { standIn } from "./release.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const digest = yield* Digest.Digest;
  const packages = path.join(import.meta.dirname, "../..");
  const dir = path.resolve();
  const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "svjeez-bin-" });
  const self = yield* read(dir);
  const encoder = new TextEncoder();

  yield* run(ChildProcess.make({ cwd: dir, stderr: "inherit" })`bun run build:package`);
  yield* run(
    ChildProcess.make({
      cwd: dir,
    })`${path.join(packages, "svjeez/node_modules/.bin/publint")} --strict package-dist`,
  );
  yield* Console.log("✓ publint");

  const tarball = path.join(
    tmp,
    (yield* run(
      ChildProcess.make({
        cwd: path.join(dir, "package-dist"),
      })`npm pack --silent --pack-destination ${tmp}`,
    ))
      .split("\n")
      .at(-1) ?? "",
  );

  const consumer = path.join(tmp, "consumer");

  yield* fs.makeDirectory(consumer);
  yield* run(
    ChildProcess.make({
      cwd: consumer,
      stdin: "ignore",
    })`npx --yes npm@11 install --no-audit --no-fund --loglevel=error ${tarball}`,
  );

  const record = path.join(tmp, "ran");
  const executable = encoder.encode(`#!/bin/sh\nprintf '%s\\n' "$@" > ${record}\n`);

  const names = TARGETS.map(
    (target) => `svjeez-${target.replace(/^bun-/, "")}${target.includes("windows") ? ".exe" : ""}`,
  );

  const release = (sum: string) =>
    standIn({
      "svjeez-checksums.txt": encoder.encode(
        `${names.map((name) => `${sum}  ${name}`).join("\n")}\n`,
      ),
      ...Object.fromEntries(names.map((name) => [name, executable])),
    });

  yield* release(yield* digest.digestHex(Digest.sha256, executable)).pipe(
    Effect.flatMap((release) => {
      const env = { SVJEEZ_RELEASES: release.url, XDG_CACHE_HOME: path.join(tmp, "cache") };
      const launcher = path.join(consumer, "node_modules/@svjeez/bin/bin/svjeez.js");

      return Effect.gen(function* () {
        yield* run(
          ChildProcess.make({
            cwd: consumer,
            env,
            extendEnv: true,
            stdin: "ignore",
          })`node_modules/.bin/svjeez check scene.tsx --sheet`,
        );

        if ((yield* fs.readFileString(record)) !== "check\nscene.tsx\n--sheet\n")
          return yield* new ScriptError({
            message:
              "The installed launcher did not run the executable with its arguments on Node.",
          });

        yield* run(
          ChildProcess.make({
            cwd: consumer,
            env,
            extendEnv: true,
            stdin: "ignore",
          })`${process.execPath} ${launcher} version`,
        );

        if ((yield* fs.readFileString(record)) !== "version\n")
          return yield* new ScriptError({
            message: "The installed launcher did not run the executable on Bun.",
          });

        const asked = release.asked().filter((asked) => !asked.endsWith("svjeez-checksums.txt"));

        if (asked.length !== 1 || !names.some((name) => asked[0] === `/v${self.version}/${name}`))
          return yield* new ScriptError({
            message:
              "The installed launcher did not download its version's executable exactly once.",
          });
      });
    }),
  );

  yield* release("0".repeat(64)).pipe(
    Effect.flatMap((release) => {
      const env = { SVJEEZ_RELEASES: release.url, XDG_CACHE_HOME: path.join(tmp, "other") };

      return run(
        ChildProcess.make({
          cwd: consumer,
          env,
          extendEnv: true,
          stdin: "ignore",
        })`node_modules/.bin/svjeez version`,
      ).pipe(
        Effect.flip,
        Effect.flatMap((failure) =>
          failure.message.includes("doesn't match its checksum")
            ? Effect.void
            : new ScriptError({
                message: "The installed launcher ran an executable that fails its checksum.",
              }),
        ),
      );
    }),
  );

  yield* Console.log(`${self.name} package checks passed on ${process.version}`);
}).pipe(Effect.scoped, Effect.provide(Services.layer), BunRuntime.runMain);
