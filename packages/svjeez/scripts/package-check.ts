import { BunRuntime } from "@effect/platform-bun";
import { Array, Console, Effect, FileSystem, Function, Option, Path } from "effect";
import { ChildProcess } from "effect/process";
import { ScriptError } from "../../../scripts/errors";
import { run } from "../../../scripts/process";
import * as Services from "../../../scripts/services";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");
  const bin = path.join(root, "node_modules/.bin");
  const dir = yield* fs.makeTempDirectoryScoped({ prefix: "svjeez-package-" });
  const consumer = path.join(dir, "consumer");
  const quickstart = path.join(dir, "quickstart");

  const check = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) =>
    effect.pipe(
      Effect.andThen(Console.log(`✓ ${name}`)),
      Effect.mapError(
        (cause) => new ScriptError({ message: `The "${name}" check failed.`, cause }),
      ),
      Effect.tapCause(Effect.logError),
      Effect.mapError(() => name),
    );

  const tarball = path.join(
    dir,
    (yield* run(
      ChildProcess.make({
        cwd: root,
        stdin: "ignore",
      })`npm pack --silent --pack-destination ${dir}`,
    ))
      .split("\n")
      .at(-1) ?? "",
  );

  yield* fs.makeDirectory(path.join(consumer, "node_modules/svjeez"), { recursive: true });
  yield* run(
    ChildProcess.make({
      cwd: root,
      stdin: "ignore",
    })`tar -xzf ${tarball} -C ${path.join(consumer, "node_modules/svjeez")} --strip-components=1`,
  );

  yield* fs.writeFileString(
    path.join(consumer, "index.tsx"),
    `import { Shape, circle, ease, enter, param, scene, span } from "svjeez";
import { svg as backend } from "svjeez/tools";
import { renderFrames } from "svjeez/frames";

export const speed = param.number(1, { min: 0, max: 4 });

// @ts-expect-error a circle's radius is a number
circle("2");
export const svg: string = backend.emit(scene({ size: [10, 10], duration: 1, title: "t" }, () => <Shape geometry={circle(2)} fill="#000000" motion={enter(span(0, 1), { from: { scale: 0 }, curve: ease.pop })} />));
export { renderFrames };
`,
  );

  const compilers = yield* Effect.forEach(
    [
      { compiler: "TypeScript 5.4", tsc: ["npx", "--yes", "--package", "typescript@5.4", "tsc"] },
      { compiler: "TypeScript latest", tsc: [path.join(bin, "tsc")] },
    ],
    ({ compiler, tsc }) =>
      run(ChildProcess.make({ cwd: root, stdin: "ignore" })`${tsc} --version`).pipe(
        Effect.map((version) =>
          [
            { moduleResolution: "node10", module: "commonjs", type: "commonjs" },
            { moduleResolution: "node16", module: "node16", type: "module" },
            { moduleResolution: "nodenext", module: "nodenext", type: "module" },
            { moduleResolution: "bundler", module: "esnext", type: "module" },
          ].flatMap(({ moduleResolution, module, type }) =>
            moduleResolution === "node10" && !version.startsWith("Version 5.")
              ? []
              : [
                  check(
                    `${compiler} under ${moduleResolution}`,
                    Effect.all([
                      fs.writeFileString(
                        path.join(consumer, "package.json"),
                        JSON.stringify({ type }),
                      ),
                      fs.writeFileString(
                        path.join(consumer, "tsconfig.json"),
                        JSON.stringify({
                          compilerOptions: {
                            module,
                            moduleResolution,
                            target: "es2022",
                            lib: ["es2022", "dom"],
                            types: [],
                            jsx: "react-jsx",
                            jsxImportSource: "svjeez",
                            strict: true,
                            noEmit: true,
                            skipLibCheck: false,
                          },
                          files: ["index.tsx"],
                        }),
                      ),
                      run(
                        ChildProcess.make({
                          cwd: root,
                          stdin: "ignore",
                          stdout: "inherit",
                        })`${tsc} -p ${consumer}`,
                      ),
                    ]),
                  ),
                ],
          ),
        ),
      ),
  );

  const [, failed] = yield* Effect.partition(
    [
      check(
        "publint",
        run(
          ChildProcess.make({ cwd: root, stdin: "ignore" })`${path.join(bin, "publint")} --strict`,
        ),
      ),
      check(
        "arethetypeswrong",
        run(
          ChildProcess.make({
            cwd: root,
            stdin: "ignore",
          })`${path.join(bin, "attw")} ${tarball} --ignore-rules cjs-resolves-to-esm`,
        ),
      ),
      ...compilers.flat(),
      check(
        "README quickstart on the packed CLI",
        Effect.gen(function* () {
          const readme = yield* fs.readFileString(
            path.join(consumer, "node_modules/svjeez/README.md"),
          );

          const block = (lang: string, marker: string) =>
            Array.findFirst(readme.split("```" + lang + "\n").slice(1), (rest) =>
              rest.includes(marker),
            ).pipe(
              Option.map((rest) => rest.split("\n```")[0] ?? ""),
              Effect.fromOption(
                () => new ScriptError({ message: `The README quickstart has no ${lang} block.` }),
              ),
            );

          const scene = yield* block("tsx", "export default scene(");

          const title = yield* Option.fromNullishOr(/title: "([^"]+)"/.exec(scene)?.[1]).pipe(
            Effect.fromOption(
              () => new ScriptError({ message: "The README quickstart sets no scene title." }),
            ),
          );

          yield* fs.makeDirectory(quickstart);
          yield* run(ChildProcess.make({ cwd: quickstart, stdin: "ignore" })`npm init -y`);
          yield* run(
            ChildProcess.make({ cwd: quickstart, stdin: "ignore" })`npm pkg set type=module`,
          );
          yield* run(
            ChildProcess.make({
              cwd: quickstart,
              stdin: "ignore",
            })`npm install --no-audit --no-fund ${tarball}`,
          );
          yield* run(
            ChildProcess.make({
              cwd: quickstart,
              stdin: "ignore",
            })`npm install --no-audit --no-fund -D tsx typescript`,
          );
          yield* fs.writeFileString(
            path.join(quickstart, "tsconfig.json"),
            yield* block("json", "jsxImportSource"),
          );
          yield* fs.writeFileString(path.join(quickstart, "scene.tsx"), scene);
          yield* run(
            ChildProcess.make({
              cwd: quickstart,
              stdin: "ignore",
              stdout: "inherit",
            })`${path.join(quickstart, "node_modules/.bin/tsc")} --noEmit`,
          );

          yield* run(
            ChildProcess.make({
              cwd: quickstart,
              stdin: "ignore",
            })`${process.execPath} node_modules/svjeez/package-dist/cli.js svg scene.tsx --out hello.svg`,
          );

          if (
            !(yield* fs.readFileString(path.join(quickstart, "hello.svg"))).includes(
              `>${title}</title>`,
            )
          )
            return yield* new ScriptError({
              message: "The README quickstart did not render its scene.",
            });
        }),
      ),
      ...[
        "svjeez",
        "svjeez/jsx-runtime",
        "svjeez/jsx-dev-runtime",
        "svjeez/tools",
        "svjeez/frames",
        "svjeez/page",
      ].map((entry) =>
        check(
          `import and require ${entry}`,
          Effect.all([
            run(
              ChildProcess.make({
                cwd: consumer,
                stdin: "ignore",
              })`${process.execPath} --input-type=module -e ${`await import(${JSON.stringify(entry)})`}`,
            ),
            run(
              ChildProcess.make({
                cwd: consumer,
                stdin: "ignore",
              })`${process.execPath} -e ${`require(${JSON.stringify(entry)})`}`,
            ),
          ]),
        ),
      ),
    ],
    Function.identity,
  );

  yield* Console.log(
    `package checks ${failed.length === 0 ? "passed" : "failed"} on ${process.version}`,
  );

  if (failed.length > 0)
    return yield* new ScriptError({
      message: `Package checks ${failed.join(", ")} failed on ${process.version}.`,
    });
}).pipe(Effect.scoped, Effect.provide(Services.layer), BunRuntime.runMain);
