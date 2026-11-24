import { BunRuntime } from "@effect/platform-bun";
import {
  Array,
  Config,
  Console,
  Effect,
  FileSystem,
  Option,
  Path,
  Result,
  Schema,
  SemVer,
  Sink,
  Stdio,
  Stream,
} from "effect";
import { Argument, Command } from "effect/cli";
import { HttpClient, HttpClientResponse } from "effect/http";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { nextVersion, packageDirs, publishable, sharedVersion } from "./package-manifest.ts";
import { ScriptError } from "./errors.ts";
import { run } from "./process.ts";
import * as Services from "./services.ts";

const tagFor = (name: string, version: string) =>
  name === "svjeez" ? `v${version}` : `${name}@${version}`;

const distTag = (version: string) => (version.includes("-") ? "next" : "latest");

const build = Effect.fn("build")(function* (pkg: { dir: string; out: string }) {
  if (pkg.out !== pkg.dir)
    yield* run(
      ChildProcess.make({
        cwd: pkg.dir,
        stdin: "inherit",
        stderr: "inherit",
      })`bun run build:package`,
    );
});

const published = Effect.fn("published")(function* (name: string) {
  const response = yield* HttpClient.get(`https://registry.npmjs.org/${name.replace("/", "%2f")}`);

  if (response.status === 404) return Option.none();

  const { versions } = yield* HttpClientResponse.filterStatusOk(response).pipe(
    Effect.flatMap(
      HttpClientResponse.schemaBodyJson(
        Schema.Struct({ versions: Schema.Record(Schema.String, Schema.Unknown) }),
      ),
    ),
  );

  return Option.some(new Set(Object.keys(versions)));
});

const releases = run(
  ChildProcess.make`gh api --paginate "repos/{owner}/{repo}/releases?per_page=100" --jq ".[].tag_name"`,
).pipe(Effect.map((out) => out.split("\n").filter(Boolean)));

const pending = Effect.gen(function* () {
  const path = yield* Path.Path;
  const root = path.join(import.meta.dirname, "..");
  const tags = yield* releases;
  const actions = yield* Config.Boolean("GITHUB_ACTIONS").pipe(Config.withDefault(false));

  const branch = yield* Config.String("GITHUB_REF_NAME").pipe(
    Effect.catch(() => run(ChildProcess.make`git branch --show-current`)),
  );

  const warn = (message: string) => Console.log(actions ? `::warning::${message}` : message);

  const packages = Array.getSomes(
    yield* Effect.forEach(yield* packageDirs, publishable, { concurrency: "unbounded" }),
  );

  const byName = new Map(packages.map((pkg) => [pkg.manifest.name, pkg]));

  const depth = (name: string): number =>
    Math.max(
      0,
      ...Object.keys(byName.get(name)?.manifest.dependencies ?? {}).flatMap((dependency) =>
        byName.has(dependency) ? [1 + depth(dependency)] : [],
      ),
    );

  const [releasable, stable] = Array.partition(
    packages.toSorted((a, b) => depth(a.manifest.name) - depth(b.manifest.name)),
    (pkg) =>
      branch === "main" || pkg.manifest.version.includes("-")
        ? Result.succeed(pkg)
        : Result.fail(pkg),
  );

  yield* Effect.forEach(stable, ({ manifest: { name, version } }) =>
    warn(
      `${name} ${version} is a stable version on ${branch}, so it isn't released. Only main releases stable versions.`,
    ),
  );

  const found = yield* Effect.forEach(
    releasable,
    (pkg) => published(pkg.manifest.name).pipe(Effect.map((versions) => ({ pkg, versions }))),
    { concurrency: "unbounded" },
  );

  yield* Effect.forEach(
    found.filter(({ versions }) => Option.isNone(versions)),
    ({ pkg }) =>
      warn(
        `${pkg.manifest.name} isn't on npm yet. Run \`bun scripts/release.ts claim ${path.relative(root, pkg.dir)}\` once, and this workflow releases it after that.`,
      ),
  );

  return found
    .flatMap(({ pkg, versions }) =>
      Option.toArray(versions).map((versions) => {
        const tag = tagFor(pkg.manifest.name, pkg.manifest.version);

        return { pkg, tag, npm: !versions.has(pkg.manifest.version), github: !tags.includes(tag) };
      }),
    )
    .filter(({ npm, github }) => npm || github);
});

const plan = Command.make("plan", {}, () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const names = (yield* pending).map(({ pkg }) => pkg.manifest.name);

    yield* Console.log(names.length > 0 ? `To release: ${names.join(", ")}` : "Nothing to release");

    const output = yield* Config.String("GITHUB_OUTPUT").pipe(Config.option);

    if (Option.isSome(output))
      yield* fs.writeFileString(output.value, `packages=${names.join(" ")}\n`, { flag: "a" });
  }),
);

const publish = Command.make("publish", {}, () =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const root = path.join(import.meta.dirname, "..");
    const tmp = yield* fs.makeTempDirectoryScoped({ prefix: "svjeez-release-" });
    const tags = yield* releases;

    yield* Effect.forEach(yield* pending, ({ pkg, tag, npm, github }) =>
      Effect.gen(function* () {
        const { name, version } = pkg.manifest;
        const prerelease = version.includes("-");

        yield* build(pkg);

        const tarball = path.join(
          tmp,
          (yield* run(
            ChildProcess.make({
              cwd: pkg.out,
              stderr: "inherit",
            })`npm pack --silent --pack-destination ${tmp}`,
          ))
            .split("\n")
            .at(-1) ?? "",
        );

        if (npm)
          yield* run(
            ChildProcess.make({
              stdin: "inherit",
              stderr: "inherit",
            })`npm publish ${tarball} --provenance --access public --tag ${distTag(version)}`,
          );

        if (github) {
          const current = SemVer.parseUnsafe(version);
          const prefix = tagFor(name, "");

          const start = Array.last(
            Array.sort(
              tags
                .flatMap((other) =>
                  other.startsWith(prefix)
                    ? Option.toArray(Result.getSuccess(SemVer.parse(other.slice(prefix.length))))
                    : [],
                )
                .filter((other) => SemVer.isLessThan(other, current)),
              SemVer.Order,
            ),
          );

          const target = yield* Config.String("GITHUB_SHA").pipe(
            Effect.catch(() => run(ChildProcess.make`git rev-parse HEAD`)),
          );

          const range = Option.match(start, {
            onNone: () => target,
            onSome: (start) => `${tagFor(name, SemVer.format(start))}..${target}`,
          });

          const notes = yield* run(
            ChildProcess.make({
              stderr: "inherit",
            })`git log --no-merges --format=${"- %s (%h)"} ${range} -- ${path.relative(root, pkg.dir)}`,
          );

          yield* run(
            ChildProcess.make({
              stdin: "inherit",
              stderr: "inherit",
            })`gh release create ${tag} ${tarball} --target ${target} --title ${`${name} ${version}`} --notes ${notes || "No changes to this package."} --latest=${name === "svjeez" && !prerelease} ${prerelease ? ["--prerelease"] : []}`,
          );
        }

        yield* Console.log(`Released ${name} ${version}`);
      }),
    );
  }),
);

const claim = Command.make(
  "claim",
  {
    dir: Argument.String("dir").pipe(
      Argument.withDescription("the package's folder, as in packages/vite"),
    ),
  },
  ({ dir }) =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const stdio = yield* Stdio.Stdio;

      const pkg = yield* publishable(path.resolve(dir)).pipe(
        Effect.flatMap(
          Effect.fromOption(
            () =>
              new ScriptError({
                message: `${dir} is private, so it isn't released.`,
              }),
          ),
        ),
      );

      const { name, version } = pkg.manifest;

      const repo = yield* Schema.decodeUnknownEffect(Schema.Struct({ url: Schema.String }))(
        pkg.manifest.repository,
      ).pipe(
        Effect.map(({ url }) =>
          Option.fromNullishOr(/github\.com[/:](.+?)(\.git)?$/.exec(url)?.[1]),
        ),
        Effect.flatMap(Effect.fromOption),
        Effect.mapError(
          () =>
            new ScriptError({
              message: `${name}'s package.json needs a GitHub repository.url, which npm checks the workflow against.`,
            }),
        ),
      );

      if (Option.isSome(yield* published(name)))
        yield* Console.log(`${name} is already on npm, so this only adds the trusted publisher.`);
      else {
        yield* build(pkg);

        const staged = yield* Effect.scoped(
          Effect.gen(function* () {
            const handle = yield* spawner.spawn(
              ChildProcess.make({
                cwd: pkg.out,
                stdin: "inherit",
                stdout: "inherit",
              })`npm publish --access public --tag ${distTag(version)}`,
            );

            const [stderr, code] = yield* Effect.all(
              [
                handle.stderr.pipe(
                  Stream.decodeText(),
                  Stream.tapSink(Sink.mapInput(stdio.stderr(), (text: string) => text)),
                  Stream.mkString,
                ),
                handle.exitCode,
              ],
              { concurrency: "unbounded" },
            );

            if (code === 0) return false;

            if (stderr.includes("previously staged version")) return true;

            return yield* new ScriptError({
              message: `"npm publish" exited with ${code}. ${stderr}`,
            });
          }),
        );

        yield* Console.log(
          staged
            ? `${name} ${version} is already staged from an earlier claim, so this only adds the trusted publisher.`
            : "npm stages a new package's first version.",
          `Approve ${name} ${version} under Staged Packages on npmjs.com, or with \`npm stage approve\`.`,
        );
      }

      const Publisher = Schema.Struct({
        type: Schema.String,
        repository: Schema.optional(Schema.String),
        file: Schema.optional(Schema.String),
      });

      const trusted = yield* run(
        ChildProcess.make({ stderr: "inherit" })`npm trust list ${name} --json`,
      ).pipe(
        Effect.flatMap((out) =>
          Schema.decodeEffect(
            Schema.fromJsonString(Schema.Union([Publisher, Schema.Array(Publisher)])),
          )(out || "[]"),
        ),
        Effect.map((listed) =>
          [listed]
            .flat()
            .some((p) => p.type === "github" && p.repository === repo && p.file === "release.yml"),
        ),
      );

      if (trusted) return yield* Console.log(`release.yml can already publish ${name}.`);

      yield* run(
        ChildProcess.make({
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        })`npm trust github ${name} --repo ${repo} --file release.yml --env npm --allow-publish --yes`,
      );

      yield* Console.log(
        `release.yml can now publish ${name}. Its next run on main adds the GitHub release for ${version}.`,
      );
    }),
);

const preview = Command.make("preview", {}, () =>
  Effect.gen(function* () {
    const packages = Array.getSomes(
      yield* Effect.forEach(yield* packageDirs, publishable, { concurrency: "unbounded" }),
    );

    yield* Effect.forEach(packages, build);

    yield* run(
      ChildProcess.make({
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      })`bun run pkg-pr-new publish --commentWithSha --packageManager=bun --template ./templates/* ${packages.map(({ out }) => out)}`,
    );
  }),
);

const version = Command.make(
  "version",
  {
    bump: Argument.String("bump").pipe(
      Argument.withDescription("next, minor, major, stable or a version"),
    ),
  },
  ({ bump }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const dirs = yield* packageDirs;
      const current = yield* sharedVersion(dirs);
      const target = yield* nextVersion(current, bump);

      yield* Effect.forEach(
        dirs.map((dir) => path.join(dir, "package.json")),
        (file) =>
          fs
            .readFileString(file)
            .pipe(
              Effect.flatMap((text) =>
                fs.writeFileString(
                  file,
                  text.replace(`"version": "${current}"`, `"version": "${target}"`),
                ),
              ),
            ),
        { concurrency: "unbounded" },
      );

      yield* run(
        ChildProcess.make({
          cwd: path.join(import.meta.dirname, ".."),
          stderr: "inherit",
        })`bun install`,
      );
      yield* Console.log(`${current} → ${target}. Commit, push to main, then run release.yml.`);
    }),
);

Command.make("release").pipe(
  Command.withSubcommands([
    plan.pipe(
      Command.withDescription("Print the packages that need an npm publish or a GitHub release"),
    ),
    publish.pipe(Command.withDescription("Publish every pending package to npm and GitHub")),
    claim.pipe(
      Command.withDescription(
        "Stage a new package's first version on npm and trust release.yml to publish it",
      ),
    ),
    preview.pipe(
      Command.withDescription(
        "Build every package and publish this commit's preview to pkg.pr.new",
      ),
    ),
    version.pipe(Command.withDescription("Move every package to the next version together")),
  ]),
  Command.run({ version: "internal" }),
  Effect.scoped,
  Effect.provide(Services.layer),
  BunRuntime.runMain,
);
