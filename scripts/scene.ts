import { BunRuntime } from "@effect/platform-bun";
import { tmpdir } from "node:os";
import { Effect, FileSystem, Path } from "effect";
import { Argument, Command } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { Exited, ScriptError } from "./errors.ts";
import * as Services from "./services.ts";

const svjeez = Effect.fn("svjeez")(function* (
  command: string,
  scene: string,
  rest: ReadonlyArray<string>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const root = path.join(import.meta.dirname, "..");
  const examples = path.join(root, "examples");
  const site = path.join(root, "site");
  const scenes = path.join(site, "src/scenes");
  const name = scene.replace(/^site:/, "");

  const tried = scene.startsWith("site:")
    ? [path.join(scenes, `${name}.tsx`), path.join(scenes, name, "index.tsx")]
    : [
        path.resolve(name),
        path.join(examples, name, "index.tsx"),
        path.join(examples, `${name}.tsx`),
        path.join(examples, name),
        path.join(scenes, `${name}.tsx`),
        path.join(scenes, name, "index.tsx"),
      ];

  const file = yield* Effect.findFirst(
    tried.filter((file) => /\.(tsx?|jsx?|svg)$/.test(file)),
    fs.exists,
  ).pipe(
    Effect.flatMap(
      Effect.fromOption(
        () =>
          new ScriptError({ message: `No scene called "${scene}". Tried ${tried.join(", ")}.` }),
      ),
    ),
  );

  const flags = rest.map((arg, i) =>
    ["--out", "-o", "--params"].includes(rest[i - 1] ?? "") ? path.resolve(arg) : arg,
  );

  const out =
    command === "frames" && !rest.some((arg) => arg === "--out" || arg === "-o")
      ? ["--out", path.join(tmpdir(), "svjeez", path.basename(name.replace(/\.tsx?$/, "")))]
      : [];

  const code = yield* spawner.exitCode(
    ChildProcess.make({
      cwd: [examples, site].find((dir) => file.startsWith(dir + path.sep)) ?? path.dirname(file),
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    })`bun --conditions @svjeez/source ${path.join(root, "packages/svjeez/src/cli.ts")} ${command} ${file} ${flags} ${out}`,
  );

  if (code !== 0) return yield* new Exited({ code });
});

Command.make("scene").pipe(
  Command.withDescription(
    `Runs the svjeez CLI from source on one scene. frames writes to ${tmpdir()}/svjeez/<scene> unless you pass --out.`,
  ),
  Command.withSubcommands(
    ["svg", "dev", "check", "frames", "video"].map((command) =>
      Command.make(command, {
        scene: Argument.String("scene").pipe(
          Argument.withDescription(
            "an example name (pendulum, readme/hero, mermaid-types/pie), site:<name> for site/src/scenes, or a path",
          ),
        ),
        flags: Argument.String("flags").pipe(
          Argument.variadic(),
          Argument.withDescription(
            "after --, passed to the svjeez CLI (bun packages/svjeez/src/cli.ts --help)",
          ),
        ),
      }).pipe(
        Command.withDescription(`svjeez ${command} <scene> -- [flags]`),
        Command.withHandler(({ scene, flags }) => svjeez(command, scene, flags)),
      ),
    ),
  ),
  Command.run({ version: "internal" }),
  Effect.provide(Services.layer),
  BunRuntime.runMain,
);
