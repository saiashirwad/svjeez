import { createRequire } from "node:module";
import {
  Array,
  Console,
  Effect,
  FileSystem,
  Option,
  Path,
  Predicate,
  Record,
  Schema,
  Tuple,
} from "effect";
import { Digest } from "effect/crypto";
import { Base64 } from "effect/encoding";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { ScriptError } from "../../../scripts/errors.ts";
import { read as readManifest } from "../../../scripts/package-manifest.ts";
import { run } from "../../../scripts/process.ts";
import { MODULES, PACKAGES } from "../src/modules.ts";

export const TARGETS: ReadonlyArray<Bun.Build.CompileTarget> = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
];

const URL_OF_FILE = /new URL\((["'])(\.{1,2}\/[^"']+)\1,\s*import\.meta\.url\)/g;

const MEDIABUNNY =
  /const BUNDLE = join\(\s*dirname\(createRequire\(import\.meta\.url\)\.resolve\("mediabunny"\)\),\s*"mediabunny\.min\.cjs",?\s*\);/;

const BINARY = "**/*.{ttf,otf,woff,woff2,png,jpg,jpeg,gif,webp}";

export const pack = Effect.fn("pack")(function* (version: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const here = path.join(import.meta.dirname, "..");
  const root = path.join(here, "../..");
  const stage = path.join(here, ".build");
  const require = createRequire(path.join(here, "package.json"));
  const skill = path.join(root, "packages/svjeez/skills/svjeez");
  const node = path.dirname(require.resolve("@types/node/package.json"));

  const read = (dir: string, pattern: string, exclude?: ReadonlyArray<string>) =>
    fs.glob(pattern, { root: dir, exclude }).pipe(
      Effect.flatMap((files) =>
        Effect.forEach(
          files,
          (file) =>
            fs
              .readFileString(path.join(dir, file))
              .pipe(Effect.map((text): [string, string] => [file, text])),
          { concurrency: "unbounded" },
        ),
      ),
      Effect.map(Record.fromEntries),
    );

  yield* fs.remove(stage, { recursive: true, force: true });

  const types: Record<string, string> = Object.assign(
    {},
    ...(yield* Effect.forEach(
      PACKAGES,
      Effect.fn(function* (name) {
        const out = path.join(stage, "types", name);

        const code = yield* spawner.exitCode(
          ChildProcess.make({
            cwd: path.join(root, "packages", name),
            stdout: "inherit",
            stderr: "inherit",
          })`${path.join(root, "node_modules/.bin/tsc")} -p tsconfig.package.json --declaration --emitDeclarationOnly --noEmit false --outDir ${out}`,
        );

        if (code !== 0)
          return yield* new ScriptError({ message: `tsc could not emit the types of "${name}".` });

        return Record.mapEntries(yield* read(out, "**/*.d.ts"), (text, file) => [
          `${name}/${file}`,
          text.replace(/(from\s+["']|import\(["'])(\.\.?\/[^"']+?)\.tsx?(["'])/g, "$1$2.js$3"),
        ]);
      }),
      { concurrency: "unbounded" },
    )),
  );

  const specifiers = Record.fromEntries(
    yield* Effect.forEach(
      [...MODULES.keys()],
      Effect.fn(function* (specifier) {
        const [, name = "svjeez", sub] =
          /^(?:@svjeez\/([^/]+)|svjeez)(?:\/(.+))?$/.exec(specifier) ?? [];

        const exports = yield* Schema.decodeUnknownEffect(
          Schema.Record(
            Schema.String,
            Schema.Union([
              Schema.String,
              Schema.Struct({ "@svjeez/source": Schema.optional(Schema.String) }),
            ]),
          ),
        )((yield* readManifest(path.join(root, "packages", name))).exports);

        const source = yield* Option.fromUndefinedOr(exports[sub ? `./${sub}` : "."]).pipe(
          Option.flatMapNullishOr((target) =>
            Predicate.isString(target) ? target : target["@svjeez/source"],
          ),
          Option.filter((source) => source.startsWith("./src/")),
          Effect.fromOption(
            () =>
              new ScriptError({
                message: `"${specifier}" is not a ./src/ export of packages/${name}/package.json.`,
              }),
          ),
        );

        const file = `${name}/${source.slice("./src/".length).replace(/\.tsx?$/, ".d.ts")}`;

        if (!(file in types))
          return yield* new ScriptError({
            message: `tsc emitted no "${file}" for "${specifier}".`,
          });

        return Tuple.make(specifier, file);
      }),
      { concurrency: "unbounded" },
    ),
  );

  const body = {
    specifiers,
    types,
    libs: yield* read(
      path.dirname(require.resolve("typescript/lib/typescript.js")),
      "lib{,.*}.d.ts",
    ),
    node: {
      ...Record.mapKeys(
        yield* read(node, "{**/*.d.ts,package.json}"),
        (file) => `@types/node/${file}`,
      ),
      ...Record.mapKeys(
        yield* read(
          path.dirname(
            createRequire(path.join(node, "package.json")).resolve("undici-types/package.json"),
          ),
          "{**/*.d.ts,package.json}",
        ),
        (file) => `undici-types/${file}`,
      ),
    },
    skill: yield* read(skill, "**/*.*", [BINARY]),
    skillBinary: Record.fromEntries(
      yield* Effect.forEach(
        yield* fs.glob(BINARY, { root: skill }),
        (file) =>
          fs
            .readFile(path.join(skill, file))
            .pipe(Effect.map((bytes): [string, string] => [file, Base64.encode(bytes)])),
        { concurrency: "unbounded" },
      ),
    ),
  };

  yield* fs.writeFileString(
    path.join(stage, "assets.pack"),
    JSON.stringify({
      version,
      hash: (yield* (yield* Digest.Digest).digestHex(
        Digest.sha256,
        new TextEncoder().encode(version + JSON.stringify(body)),
      )).slice(0, 16),
      ...body,
    }),
  );
});

export const compile = Effect.fn("compile")(function* (
  version: string,
  target: Bun.Build.CompileTarget | undefined,
  outdir: string,
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const here = path.join(import.meta.dirname, "..");
  const packages = path.join(here, "..");

  const outfile = path.join(
    outdir,
    target
      ? `svjeez-${target.replace(/^bun-/, "")}${target.includes("windows") ? ".exe" : ""}`
      : "svjeez",
  );

  const embedded = Record.fromEntries(
    Array.getSomes(
      yield* Effect.forEach(
        yield* fs.glob("*/src/**/*.{ts,tsx}", { root: packages }),
        Effect.fn(function* (source) {
          const file = path.join(packages, source);
          const code = yield* fs.readFileString(file);
          const video = file.endsWith(path.join("video", "src", "index.ts"));

          if (video && !MEDIABUNNY.test(code))
            return yield* new ScriptError({
              message: `"${file}" no longer finds mediabunny.min.cjs the way scripts/binary.ts expects.`,
            });

          const urls = yield* Effect.filter(
            Array.dedupe(
              [...code.matchAll(URL_OF_FILE)].map(([, , url = ""]) =>
                path.resolve(path.dirname(file), url),
              ),
            ),
            (url) =>
              fs.stat(url).pipe(
                Effect.map((info) => info.type === "File"),
                Effect.orElseSucceed(() => false),
              ),
          );

          const embeds = video
            ? [
                ...urls,
                path.join(
                  path.dirname(createRequire(file).resolve("mediabunny")),
                  "mediabunny.min.cjs",
                ),
              ]
            : urls;

          if (embeds.length === 0) return Option.none();

          return Option.some(
            Tuple.make(file, {
              contents: `${embeds.map((embed, i) => `import __svjeezFile${i} from ${JSON.stringify(embed)} with { type: "file" };\n`).join("")}import { pathToFileURL as __svjeezUrl } from "node:url";\n${code
                .replace(URL_OF_FILE, (whole: string, _quote: string, url: string) => {
                  const i = urls.indexOf(path.resolve(path.dirname(file), url));

                  return i < 0 ? whole : `__svjeezUrl(__svjeezFile${i})`;
                })
                .replace(MEDIABUNNY, `const BUNDLE = __svjeezFile${urls.length};`)}`,
              loader: file.endsWith(".tsx") ? "tsx" : "ts",
            }),
          );
        }),
        { concurrency: "unbounded" },
      ),
    ),
  );

  yield* Effect.tryPromise({
    try: () =>
      Bun.build({
        entrypoints: [path.join(here, "src/main.ts")],
        compile: {
          ...(target && { target }),
          outfile,
          autoloadBunfig: false,
          autoloadTsconfig: false,
          autoloadPackageJson: false,
        },
        conditions: ["@svjeez/source"],
        external: ["chromium-bidi", "chromium-bidi/*"],
        define: { "process.env.SVJEEZ_VERSION": JSON.stringify(version) },
        plugins: [
          {
            name: "svjeez-embed-files",
            setup: (build) => {
              build.onLoad(
                { filter: /[\\/]packages[\\/][^\\/]+[\\/]src[\\/].*\.tsx?$/ },
                ({ path }) => embedded[path],
              );
            },
          },
        ],
        throw: true,
      }),
    catch: (cause) =>
      new ScriptError({
        message: `Building svjeez for ${target ?? "this machine"} failed.`,
        cause,
      }),
  });

  if ((target ?? process.platform).includes("darwin"))
    yield* process.platform === "darwin"
      ? run(ChildProcess.make`codesign --force --sign - ${outfile}`)
      : Console.warn(
          `${path.basename(outfile)} must be signed on a Mac (codesign --force --sign -) before Apple silicon runs it.`,
        );

  return outfile;
});
