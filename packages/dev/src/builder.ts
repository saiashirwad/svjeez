import type { Controls, Signals } from "@svjeez/live";
import { Data, Effect, FileSystem, Path } from "effect";
import { build, defaults, isScene, loadTypeGpu } from "svjeez/tools";
import type { LaneReport, Scene, Schema, SvgBuild } from "svjeez/tools";

/** The scene did not build: it threw, or its default export is not a scene. The message says where, when it can. */
export class BuildFailed extends Data.TaggedError("BuildFailed")<{
  readonly message: string;
}> {}

/** Anything a module can export. */
type Exported = {} | null | undefined;

/** What a scene module may export. Each value is checked before it is used. */
interface SceneModule {
  readonly default?: Exported;
  readonly params?: Exported;
  readonly controls?: Exported;
}

/** `export const controls = (d) => ({ ...d, rhythm: derive(…) })`: the scene's own controls, made from its signals. */
export type ControlsOf = (signals: Signals) => Controls;

export interface Built extends SvgBuild {
  /** How long the import and the emit took, in milliseconds. */
  readonly ms: number;
  readonly controls?: ControlsOf;
}

type Make = (values?: Exported) => Exported;

const isMake = (value: Exported): value is Make => typeof value === "function";

const isControlsOf = (value: Exported): value is ControlsOf => typeof value === "function";

const isParam = (value: Exported): value is { readonly kind: string } =>
  typeof value === "object" && value !== null && "kind" in value;

const isSchema = (value: Exported): value is Schema =>
  typeof value === "object" && value !== null && Object.values(value).every(isParam);

const isBuilt = (value: Exported): value is Scene | string =>
  isScene(value) || typeof value === "string";

/** The module cache Bun shares between `import` and `require`. Deleting a key makes the next import read the file again. */
export const forget = (drop: (path: string) => boolean): void => {
  for (const key of Object.keys(require.cache)) if (drop(key)) delete require.cache[key];
};

/** The marker in the name of the hidden copies a preview builds from, so a watcher can skip them. */
export const DRAFT = ".svjeez-dev-";

let drafts = 0;

const describeError = (thrown: Exported, draft: string, file: string, dir: string): string => {
  const error = thrown instanceof Error ? thrown : new Error(String(thrown));

  const here = (error.stack ?? "")
    .split("\n")
    .find((line) => line.includes(dir + "/") && !line.includes("/node_modules/"));

  const where = here?.trim().replace(/^at\s+/, "");
  const said = error.message + (where && !error.message.includes(where) ? "\n    at " + where : "");

  return said.replaceAll(draft, file);
};

/**
 * Imports a scene module and builds its default export, the way `svjeez svg --json` does, in this process. With
 * `text`, it builds that text in place of the file's: a hidden copy is written beside the file, so its relative
 * imports resolve, imported, and removed. The real file is never touched. Lanes say where they were written.
 * One build at a time: tracing sources is global.
 */
export const buildScene = (
  file: string,
  text?: string,
): Effect.Effect<Built, BuildFailed, FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = path.dirname(file);
    const extension = path.extname(file);

    const target =
      text === undefined
        ? file
        : path.join(dir, "." + path.basename(file, extension) + DRAFT + ++drafts + extension);

    if (text !== undefined)
      yield* fs.writeFileString(target, text).pipe(
        Effect.mapError(
          (error) =>
            new BuildFailed({
              message: "Could not write a preview copy beside the scene: " + error.message,
            }),
        ),
      );

    let controls: ControlsOf | undefined;
    const started = performance.now();

    const built = yield* Effect.tryPromise({
      try: () =>
        build(async () => {
          await loadTypeGpu(dir);
          forget((key) => key === target);
          const module: SceneModule = await import(target);
          const made = module.default;
          const values = isSchema(module.params) ? defaults(module.params) : undefined;
          const value = isMake(made) ? await made(values) : made;

          if (isControlsOf(module.controls)) controls = module.controls;

          if (isBuilt(value)) return value;

          throw new Error(
            path.basename(file) +
              " must export default a scene, as in `export default scene({ ... }, () => ...)`, an SVG string, or a function that returns either.",
          );
        }, dir),
      catch: (thrown) =>
        new BuildFailed({ message: describeError(thrown ?? undefined, target, file, dir) }),
    }).pipe(
      Effect.ensuring(
        text === undefined
          ? Effect.void
          : fs
              .remove(target)
              .pipe(
                Effect.ignore,
                Effect.andThen(Effect.sync(() => forget((key) => key === target))),
              ),
      ),
    );

    const lanes = built.lanes.map((lane): LaneReport =>
      lane.source?.file === target ? { ...lane, source: { ...lane.source, file } } : lane,
    );

    return {
      ...built,
      lanes,
      warnings: built.warnings.map((warning) => warning.replaceAll(target, file)),
      ms: performance.now() - started,
      ...(controls && { controls }),
    };
  });
