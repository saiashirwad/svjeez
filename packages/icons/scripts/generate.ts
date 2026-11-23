import { BunRuntime } from "@effect/platform-bun";
import { Array, Console, Effect, FileSystem, Order, Path } from "effect";
import { exportName, parse } from "./svg.ts";
import { ScriptError } from "../../../scripts/errors.ts";
import * as Services from "../../../scripts/services.ts";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");

  yield* Effect.forEach(
    [
      {
        pkg: "@tabler/icons",
        out: "tabler.ts",
        folders: [
          { dir: "icons/outline", kind: "outline", suffix: "" },
          { dir: "icons/filled", kind: "solid", suffix: "-filled" },
        ],
      },
      {
        pkg: "lucide-static",
        out: "lucide.ts",
        folders: [{ dir: "icons", kind: "outline", suffix: "" }],
      },
    ] as const,
    Effect.fn(function* ({ pkg, out, folders }) {
      const base = yield* Effect.findFirst(
        [path.join(root, "node_modules", pkg), path.join(root, "../../node_modules", pkg)],
        (dir) => fs.exists(path.join(dir, "package.json")),
      ).pipe(
        Effect.flatMap(
          Effect.fromOption(
            () => new ScriptError({ message: `"${pkg}" is not installed; run bun install.` }),
          ),
        ),
      );

      const license = (yield* fs.readFileString(path.join(base, "LICENSE"))).trimEnd();

      if (license.includes("*/"))
        return yield* new ScriptError({
          message: `The LICENSE of "${pkg}" contains a comment terminator.`,
        });

      const files = (yield* Effect.forEach(
        folders,
        ({ dir, kind, suffix }) =>
          fs.readDirectory(path.join(base, dir)).pipe(
            Effect.map(
              Array.flatMap((file) =>
                file.endsWith(".svg")
                  ? [
                      {
                        file: `${dir}/${file}`,
                        id: file.slice(0, -4),
                        name: exportName(`${file.slice(0, -4)}${suffix}`),
                        kind,
                      },
                    ]
                  : [],
              ),
            ),
          ),
        { concurrency: "unbounded" },
      )).flat();

      const [icons, failed] = yield* Effect.partition(
        files,
        ({ file, id, name, kind }) =>
          Effect.gen(function* () {
            const taken = files.find((other) => other.name === name)!.file;

            if (taken !== file)
              return yield* new ScriptError({
                message: `"${file}" in "${pkg}" can't be an icon: its name ${name} is also ${taken}.`,
              });

            const svg = yield* fs.readFileString(path.join(base, file));

            return yield* Effect.fromResult(parse(id, svg, kind)).pipe(
              Effect.mapError(
                (problem) =>
                  new ScriptError({
                    message: `"${file}" in "${pkg}" can't be an icon: ${problem}.`,
                  }),
              ),
              Effect.map((icon) => ({ name, ...icon })),
            );
          }).pipe(Effect.tapCause(Effect.logError)),
        { concurrency: 32 },
      );

      if (failed.length > 0)
        return yield* new ScriptError({ message: `${failed.length} icons from "${pkg}" failed.` });

      yield* fs.writeFileString(
        path.join(root, "src", out),
        `/**\n${license
          .split("\n")
          .map((line) => (line ? ` * ${line}` : " *"))
          .join("\n")}\n */\nimport type { IconData } from "./icon.tsx";\n\n${Array.sortWith(
          icons,
          ({ name }) => name,
          Order.String,
        )
          .map(
            ({ name, grid, kind, paths }) =>
              `export const ${name}: IconData = { grid: ${grid}, kind: ${JSON.stringify(kind)}, paths: ${JSON.stringify(paths)} };\n`,
          )
          .join("")}`,
      );

      yield* Console.log(`${pkg}: ${icons.length} icons to src/${out}`);
    }),
    { concurrency: 1 },
  );
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
