import { BunRuntime } from "@effect/platform-bun";
import { Console, Effect, FileSystem, Function, Path, Predicate } from "effect";
import { validateSvg } from "svjeez/frames";
import { isScene, svg as backend } from "svjeez/tools";
import { ScriptError } from "../../../scripts/errors";
import * as Services from "../../../scripts/services";

Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");

  const scenes = yield* fs.glob("skills/svjeez/examples/*.tsx", { root });

  const [passed, failed] = yield* Effect.partition(
    scenes,
    Effect.fn(
      function* (scene) {
        const svg = yield* Effect.tryPromise({
          try: async (): Promise<string> => {
            const { default: exported } = await import(path.join(root, scene));
            const made = Predicate.isFunction(exported) ? exported() : exported;

            return isScene(made) ? backend.emit(made) : made;
          },
          catch: Function.identity,
        });

        const { errors } = validateSvg(svg);

        if (errors.length > 0)
          return yield* new ScriptError({ message: `The SVG is invalid: ${errors.join(" ")}` });

        if (!svg.includes("@keyframes"))
          return yield* new ScriptError({ message: "The scene has no animation." });

        yield* Console.log(`✓ ${scene}`);
      },
      (effect, scene) =>
        effect.pipe(
          Effect.mapError(
            (cause) => new ScriptError({ message: `Rendering "${scene}" failed.`, cause }),
          ),
          Effect.tapCause(Effect.logError),
          Effect.mapError(() => scene),
        ),
    ),
  );

  yield* Console.log(`${passed.length}/${scenes.length} scenes rendered on ${process.version}`);

  if (failed.length > 0)
    return yield* new ScriptError({
      message: `Rendering ${failed.join(", ")} failed on ${process.version}.`,
    });
}).pipe(Effect.provide(Services.layer), BunRuntime.runMain);
