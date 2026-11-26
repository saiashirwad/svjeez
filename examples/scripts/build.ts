import { BunRuntime } from "@effect/platform-bun";
import { runFilm } from "@svjeez/dom/vite";
import { Console, Effect, FileSystem, Function, Path, Predicate, Stream, String } from "effect";
import { Argument, Command } from "effect/cli";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { validateSvg } from "svjeez/frames";
import { isScene, svg as backend } from "svjeez/tools";
import { ScriptError } from "../../scripts/errors.ts";
import * as Services from "../../scripts/services.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const root = path.join(import.meta.dirname, "..");

  const files = new Map<string, string>([
    ...(yield* fs.glob("*/index.tsx", { root })).map((file): [string, string] => [
      path.dirname(file),
      file,
    ]),
    ...(yield* fs.glob("{readme,mermaid-types,dom-component,dom-svelte,plain-ts}/*.{ts,tsx}", {
      root,
    })).map((file): [string, string] => [file.replace(/\.tsx?$/, ""), file]),
  ]);

  const examples = [...files.keys()].sort();

  return yield* Command.make(
    "example",
    {
      names: Argument.ChoiceWithValue(
        "example",
        examples.map((name): [string, string] => [name, name]),
      ).pipe(Argument.variadic()),
    },
    Effect.fn(function* ({ names }) {
      const xmllint = yield* spawner
        .exitCode(ChildProcess.make({ stdout: "ignore", stderr: "ignore" })`xmllint --version`)
        .pipe(Effect.isSuccess);

      const [, failed] = yield* Effect.partition(
        names.length > 0 ? names : examples,
        Effect.fn(
          function* (name) {
            const file = path.join(root, files.get(name) ?? name);

            const svg = yield* Effect.tryPromise({
              try: async (): Promise<string> => {
                const exported = file.endsWith(".vite.tsx")
                  ? (await runFilm(file)).svg
                  : (await import(file)).default;

                const made = Predicate.isFunction(exported) ? exported() : exported;

                return isScene(made) ? backend.emit(made) : made;
              },
              catch: Function.identity,
            });

            const problem = xmllint
              ? yield* spawner
                  .string(
                    ChildProcess.make({
                      stdin: Stream.encodeText(Stream.make(svg)),
                    })`xmllint --noout -`,
                    { includeStderr: true },
                  )
                  .pipe(Effect.map(String.trim))
              : "";

            if (problem !== "") return yield* Effect.fail(new Error(`xmllint: ${problem}`));

            yield* fs.makeDirectory(path.join(root, "dist", path.dirname(name)), {
              recursive: true,
            });
            yield* fs.writeFileString(path.join(root, "dist", `${name}.svg`), svg);

            yield* Console.log(
              `✓ dist/${name}.svg  ${(svg.length / 1024).toFixed(1)} KB · ${svg.match(/@keyframes /g)?.length ?? 0} keyframes · ${svg.match(/animation-name:/g)?.length ?? 0} tracks`,
            );

            yield* Effect.forEach(validateSvg(svg).warnings, (warning) =>
              Console.warn(`  warning: ${warning}`),
            );
          },
          (effect, name) =>
            effect.pipe(
              Effect.mapError(
                (cause) => new ScriptError({ message: `Building "${name}" failed.`, cause }),
              ),
              Effect.tapCause(Effect.logError),
              Effect.mapError(() => name),
            ),
        ),
        { concurrency: "unbounded" },
      );

      if (!xmllint) yield* Console.warn("xmllint not installed, skipped");

      if (failed.length > 0)
        return yield* new ScriptError({ message: `${failed.join(", ")} failed to build.` });
    }),
  ).pipe(Command.run({ version: "internal" }));
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
