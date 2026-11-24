import { Effect, FileSystem, Option, Path, Predicate, Record, Schema, SemVer } from "effect";

import { ScriptError } from "./errors.ts";

const Strings = Schema.optional(Schema.Record(Schema.String, Schema.String));

export const Manifest = Schema.StructWithRest(
  Schema.Struct({
    name: Schema.String,
    version: Schema.String,
    private: Schema.optional(Schema.Boolean),
    publishConfig: Schema.optional(Schema.Struct({ directory: Schema.optional(Schema.String) })),
    scripts: Strings,
    dependencies: Strings,
    peerDependencies: Strings,
    optionalDependencies: Strings,
    devDependencies: Strings,
  }),
  [Schema.Record(Schema.String, Schema.Unknown)],
);

export const read = Effect.fn("read")(function* (dir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  return yield* fs
    .readFileString(path.join(dir, "package.json"))
    .pipe(Effect.flatMap(Schema.decodeEffect(Schema.fromJsonString(Manifest))));
});

export const publishable = Effect.fn("publishable")(function* (dir: string) {
  const path = yield* Path.Path;
  const manifest = yield* read(dir);

  if (manifest.private) return Option.none();

  const directory = manifest.publishConfig?.directory;

  return Option.some({
    dir,
    out: directory === undefined ? dir : path.join(dir, directory),
    manifest,
  });
});

export const packageDirs = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");

  return (yield* fs.glob("packages/*/package.json", { root })).map((file) =>
    path.join(root, path.dirname(file)),
  );
});

export const sharedVersion = Effect.fn("sharedVersion")(function* (dirs: ReadonlyArray<string>) {
  const versions = new Set(
    (yield* Effect.forEach(dirs, read, { concurrency: "unbounded" })).map(({ version }) => version),
  );

  const [version] = versions;

  if (versions.size !== 1 || version === undefined)
    return yield* new ScriptError({
      message: `The packages should share one version, but they have ${[...versions].join(", ")}.`,
    });

  return version;
});

export const nextVersion = Effect.fn("nextVersion")(function* (current: string, bump: string) {
  const { major, minor, patch, prerelease } = yield* Effect.fromResult(SemVer.parse(current)).pipe(
    Effect.mapError(
      () => new ScriptError({ message: `${current} isn't a version like 0.8.0 or 0.8.0-next.1.` }),
    ),
  );

  const [tag, next, ...rest] = prerelease;

  if (prerelease.length > 0 && (tag !== "next" || !Predicate.isNumber(next) || rest.length > 0))
    return yield* new ScriptError({
      message: `${current} isn't a version like 0.8.0 or 0.8.0-next.1.`,
    });

  switch (bump) {
    case "next":
      return Predicate.isNumber(next)
        ? `${major}.${minor}.${patch}-next.${next + 1}`
        : `${major}.${minor}.${patch + 1}-next.0`;
    case "minor":
      return `${major}.${minor + 1}.0-next.0`;
    case "major":
      return `${major + 1}.0.0-next.0`;
    case "stable":
      if (next === undefined)
        return yield* new ScriptError({ message: `${current} is already stable.` });

      return `${major}.${minor}.${patch}`;
    default:
      return yield* Effect.fromResult(SemVer.parse(bump)).pipe(
        Effect.as(bump),
        Effect.mapError(
          () =>
            new ScriptError({
              message: `${bump} isn't next, minor, major, stable or a version like 0.8.1.`,
            }),
        ),
      );
  }
});

export const publishedRanges = Effect.fn("publishedRanges")(function* <
  M extends typeof Manifest.Type,
>(manifest: M, versions: ReadonlyMap<string, string>): Effect.fn.Return<M, ScriptError> {
  const pin = (field: "dependencies" | "peerDependencies" | "optionalDependencies") => {
    const ranges = manifest[field];

    return ranges === undefined
      ? Effect.succeed({})
      : Effect.all(
          Record.map(ranges, (range, dependency) =>
            range.startsWith("workspace:")
              ? Effect.fromOption(
                  Option.fromUndefinedOr(versions.get(dependency)),
                  () =>
                    new ScriptError({
                      message: `${manifest.name} has ${dependency} at ${range}, which is not a workspace package.`,
                    }),
                ).pipe(Effect.map((version) => `^${version}`))
              : Effect.succeed(range),
          ),
        ).pipe(Effect.map((pinned) => ({ [field]: pinned })));
  };

  return {
    ...manifest,
    ...(yield* pin("dependencies")),
    ...(yield* pin("peerDependencies")),
    ...(yield* pin("optionalDependencies")),
  };
});

export const writeManifest = Effect.fn("writeManifest")(function* <Target>(
  dir: string,
  out: string,
  exports: Readonly<Record<string, Target>>,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const versions = new Map(
    (yield* Effect.forEach(yield* packageDirs, read, { concurrency: "unbounded" })).map(
      ({ name, version }) => [name, version],
    ),
  );

  const {
    private: _,
    publishConfig: __,
    scripts: ___,
    devDependencies: ____,
    ...manifest
  } = yield* read(dir);

  yield* fs.writeFileString(
    path.join(out, "package.json"),
    `${JSON.stringify({ ...(yield* publishedRanges(manifest, versions)), exports }, null, 2)}\n`,
  );

  yield* fs.copyFile(path.join(dir, "README.md"), path.join(out, "README.md"));
  yield* fs.copyFile(path.join(import.meta.dirname, "../LICENSE"), path.join(out, "LICENSE"));
});
