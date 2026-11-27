import { Effect, FileSystem, Path } from "effect";
import type { PlatformError } from "effect/PlatformError";
import { DRAFT } from "./builder.ts";

const SOURCE = /\.(?:tsx|ts)$/;
const SKIPPED = /(?:^|\/)(?:node_modules|dist|package-dist|\.[^/]+)(?:\/|$)/;
const SCENE = /export\s+default[\s\S]*\bscene\s*\(/;

/** Whether a path under a project is where a scene might be: a .ts or .tsx file outside node_modules, dist and dot folders. */
export const isCandidate = (relative: string): boolean =>
  SOURCE.test(relative) &&
  !SKIPPED.test(relative) &&
  !relative.includes(DRAFT) &&
  !relative.endsWith(".d.ts");

/** Whether a module's text reads like a scene: it default-exports something and calls `scene(…)`. Nothing runs. */
export const looksLikeScene = (text: string): boolean => SCENE.test(text);

/** The scene files under `root`, relative to it and sorted. Found by their text, so none of them is imported. */
export const scenesIn = (
  root: string,
): Effect.Effect<readonly string[], PlatformError, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const walk = (dir: string): Effect.Effect<string[], PlatformError> =>
      Effect.gen(function* () {
        const names = yield* fs.readDirectory(path.join(root, dir));

        const nested = yield* Effect.forEach(names, (name) => {
          const relative = dir === "" ? name : dir + "/" + name;

          if (SKIPPED.test(relative)) return Effect.succeed([]);

          return fs.stat(path.join(root, relative)).pipe(
            Effect.flatMap((info) =>
              info.type === "Directory"
                ? walk(relative)
                : Effect.succeed(isCandidate(relative) ? [relative] : []),
            ),
            Effect.orElseSucceed((): string[] => []),
          );
        });

        return nested.flat();
      });

    const candidates = yield* walk("");

    const found = yield* Effect.forEach(
      candidates,
      (file) =>
        fs.readFileString(path.join(root, file)).pipe(
          Effect.map((text) => (looksLikeScene(text) ? [file] : [])),
          Effect.orElseSucceed((): string[] => []),
        ),
      { concurrency: 16 },
    );

    return found.flat().sort();
  });
