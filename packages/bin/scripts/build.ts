// Builds the single-file svjeez: bun scripts/build.ts [--target bun-linux-x64 ...] [--all] [--outdir dist]
//
// 1. Declaration files for every carried package, emitted by tsc into .build/types, so `check` can report type
//    errors and `init` can give an editor the types, with no node_modules.
// 2. .build/assets.pack: those, TypeScript's lib files and the svjeez skill, as one file the binary reads on demand.
// 3. One `bun build --compile` per target. A plugin embeds the files packages read beside their code.

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parseArgs } from "node:util";
import type { BunPlugin } from "bun";
import { MODULES, PACKAGES } from "../src/modules";

const HERE = join(import.meta.dir, "..");
const ROOT = join(HERE, "../..");
const STAGE = join(HERE, ".build");
const TSC = join(ROOT, "node_modules/.bin/tsc");

export const TARGETS: readonly Bun.Build.CompileTarget[] = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
];

const isTarget = (name: string): name is Bun.Build.CompileTarget =>
  TARGETS.some((target) => target === name);

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const filesIn = (dir: string): string[] =>
  readdirSync(dir, { recursive: true, encoding: "utf8" })
    .filter((path) => statSync(join(dir, path)).isFile())
    .map((path) => path.split("\\").join("/"))
    .sort();

/** An export's target: a path, or conditions such as { "@svjeez/source": "./src/index.ts", ... }. */
type Target = string | { readonly "@svjeez/source"?: string };

interface Manifest {
  readonly version: string;
  readonly exports: Readonly<Record<string, Target>>;
}

const manifest = (name: string): Manifest =>
  JSON.parse(readFileSync(join(ROOT, "packages", name, "package.json"), "utf8"));

const isPath = (target: Target): target is string => typeof target === "string";

const sourceOf = (target: Target | undefined): string | undefined =>
  target === undefined ? undefined : isPath(target) ? target : target["@svjeez/source"];

/** Files by path: what the pack carries. */
type Files = Record<string, string>;

const declarations = () => {
  const types: Files = {};

  for (const name of PACKAGES) {
    const out = join(STAGE, "types", name);

    const tsc = Bun.spawnSync(
      [
        TSC,
        "-p",
        "tsconfig.package.json",
        "--declaration",
        "--emitDeclarationOnly",
        "--noEmit",
        "false",
        "--outDir",
        out,
      ],
      { cwd: join(ROOT, "packages", name), stdout: "pipe", stderr: "pipe" },
    );

    if (tsc.exitCode !== 0)
      fail(`tsc could not emit the types of ${name}:\n${tsc.stdout}${tsc.stderr}`);

    for (const path of filesIn(out).filter((file) => file.endsWith(".d.ts")))
      // Sources import siblings as ./x.ts; their declarations are ./x.d.ts, which ./x.js resolves to.
      types[`${name}/${path}`] = readFileSync(join(out, path), "utf8").replace(
        /(from\s+["']|import\(["'])(\.\.?\/[^"']+?)\.tsx?(["'])/g,
        "$1$2.js$3",
      );
  }

  return types;
};

/** Each carried module's declaration file, by specifier, found through its package's exports. */
const specifiers = (types: Readonly<Files>) =>
  Object.fromEntries(
    [...MODULES.keys()].map((specifier) => {
      const [, scope, rest = ""] = /^(?:@svjeez\/)?([^/]+)(?:\/(.+))?$/.exec(specifier)!;
      const name = specifier.startsWith("@svjeez/") ? scope! : "svjeez";
      const sub = specifier.startsWith("@svjeez/") ? rest : specifier.slice("svjeez".length + 1);
      const source = sourceOf(manifest(name).exports[sub ? `./${sub}` : "."]);

      if (!source?.startsWith("./src/"))
        return fail(`${specifier} is not a ./src/ export of packages/${name}/package.json.`);

      const path = `${name}/${source.slice("./src/".length).replace(/\.tsx?$/, ".d.ts")}`;

      if (!(path in types)) fail(`tsc emitted no ${path} for ${specifier}.`);

      return [specifier, path];
    }),
  );

const libs = () => {
  // The TypeScript the binary carries: 6, plain JavaScript, unlike the native 7 the repo builds with.
  const dir = dirname(
    createRequire(join(HERE, "package.json")).resolve("typescript/lib/typescript.js"),
  );

  return Object.fromEntries(
    readdirSync(dir)
      .filter((name) => /^lib\..*\.d\.ts$/.test(name) || name === "lib.d.ts")
      .map((name) => [name, readFileSync(join(dir, name), "utf8")]),
  );
};

/** A package's declaration files and manifest, by path under node_modules/. */
const typesPackage = (name: string, from: string): Files => {
  const dir = dirname(createRequire(from).resolve(`${name}/package.json`));

  return Object.fromEntries(
    filesIn(dir)
      .filter((path) => path.endsWith(".d.ts") || path === "package.json")
      .map((path) => [`${name}/${path}`, readFileSync(join(dir, path), "utf8")]),
  );
};

const nodeTypes = () => {
  const node = typesPackage("@types/node", join(HERE, "package.json"));

  const undici = typesPackage(
    "undici-types",
    join(
      dirname(createRequire(join(HERE, "package.json")).resolve("@types/node/package.json")),
      "package.json",
    ),
  );

  return { ...node, ...undici };
};

const skill = () => {
  const dir = join(ROOT, "packages/svjeez/skills/svjeez");
  const text: Files = {};
  const binary: Files = {};

  for (const path of filesIn(dir)) {
    const bytes = readFileSync(join(dir, path));

    if (/\.(ttf|otf|woff2?|png|jpe?g|gif|webp)$/i.test(path))
      binary[path] = bytes.toString("base64");
    else text[path] = bytes.toString("utf8");
  }

  return { text, binary };
};

export const pack = async (version: string): Promise<void> => {
  await rm(STAGE, { recursive: true, force: true });
  await mkdir(STAGE, { recursive: true });

  const types = declarations();
  const { text, binary } = skill();

  const body = {
    specifiers: specifiers(types),
    types,
    libs: libs(),
    node: nodeTypes(),
    skill: text,
    skillBinary: binary,
  };

  const hash = createHash("sha256")
    .update(version)
    .update(JSON.stringify(body))
    .digest("hex")
    .slice(0, 16);

  await writeFile(join(STAGE, "assets.pack"), JSON.stringify({ version, hash, ...body }));
};

const URL_OF_FILE = /new URL\((["'])(\.{1,2}\/[^"']+)\1,\s*import\.meta\.url\)/g;

const MEDIABUNNY =
  /const BUNDLE = join\(\s*dirname\(createRequire\(import\.meta\.url\)\.resolve\("mediabunny"\)\),\s*"mediabunny\.min\.cjs",?\s*\);/;

/**
 * Files a package reads beside its code (a stroke font, the mediabunny bundle a video page loads) aren't in a bundle.
 * Import each with { type: "file" } instead, which embeds it and gives its path inside the binary.
 */
const embedFiles: BunPlugin = {
  name: "svjeez-embed-files",
  setup(build) {
    build.onLoad({ filter: /[\\/]packages[\\/][^\\/]+[\\/]src[\\/].*\.tsx?$/ }, ({ path }) => {
      let code = readFileSync(path, "utf8");
      const embedded: string[] = [];

      const embed = (file: string): string => {
        embedded.push(
          `import __svjeezFile${embedded.length} from ${JSON.stringify(file)} with { type: "file" };`,
        );

        return `__svjeezFile${embedded.length - 1}`;
      };

      code = code.replace(URL_OF_FILE, (whole, _quote: string, target: string) => {
        const file = resolve(dirname(path), target);

        // A folder, such as the CLI's skill, is served by the host instead.
        if (!existsSync(file) || !statSync(file).isFile()) return whole;

        return `__svjeezUrl(${embed(file)})`;
      });

      if (path.endsWith(join("video", "src", "index.ts"))) {
        if (!MEDIABUNNY.test(code))
          fail(
            `${path} no longer finds mediabunny.min.cjs the way scripts/build.ts expects; update MEDIABUNNY.`,
          );

        const bundle = join(
          dirname(createRequire(path).resolve("mediabunny")),
          "mediabunny.min.cjs",
        );

        code = code.replace(MEDIABUNNY, `const BUNDLE = ${embed(bundle)};`);
      }

      if (embedded.length === 0) return undefined;

      return {
        contents: `${embedded.join("\n")}\nimport { pathToFileURL as __svjeezUrl } from "node:url";\n${code}`,
        loader: path.endsWith(".tsx") ? "tsx" : "ts",
      };
    });
  },
};

const outfileFor = (outdir: string, target: string | undefined): string =>
  join(
    outdir,
    target
      ? `svjeez-${target.replace(/^bun-/, "")}${target.includes("windows") ? ".exe" : ""}`
      : "svjeez",
  );

/**
 * A macOS binary built for another architecture keeps bun's signature, which the appended scene payload breaks, and
 * Apple silicon kills a binary whose signature is invalid. Sign it again, ad hoc, which needs a Mac.
 */
const sign = (outfile: string, target: Bun.Build.CompileTarget | undefined): void => {
  const forMac = target ? target.includes("darwin") : process.platform === "darwin";

  if (!forMac) return;

  if (process.platform !== "darwin") {
    console.warn(
      `${basename(outfile)} must be signed on a Mac (codesign --force --sign -) before Apple silicon runs it.`,
    );

    return;
  }

  const signed = Bun.spawnSync(["codesign", "--force", "--sign", "-", outfile], { stderr: "pipe" });

  if (signed.exitCode !== 0) fail(`codesign failed for ${outfile}:\n${signed.stderr}`);
};

export const compile = async (
  version: string,
  target: Bun.Build.CompileTarget | undefined,
  outdir: string,
): Promise<string> => {
  const outfile = outfileFor(outdir, target);

  const result = await Bun.build({
    entrypoints: [join(HERE, "src/main.ts")],
    compile: {
      ...(target && { target }),
      outfile,
      // The binary is the whole toolchain: a bunfig.toml, tsconfig.json or package.json where it runs (a preload,
      // other JSX settings) must not change how it loads a scene.
      autoloadBunfig: false,
      autoloadTsconfig: false,
      autoloadPackageJson: false,
    },
    conditions: ["@svjeez/source"],
    // playwright-core's WebDriver BiDi transport, which svjeez never uses.
    external: ["chromium-bidi", "chromium-bidi/*"],
    define: { "process.env.SVJEEZ_VERSION": JSON.stringify(version) },
    plugins: [embedFiles],
  });

  if (!result.success)
    fail(`bun build failed for ${target ?? "this machine"}:\n${result.logs.join("\n")}`);

  sign(outfile, target);

  return outfile;
};

if (import.meta.main) {
  const { values } = parseArgs({
    options: {
      target: { type: "string", multiple: true },
      all: { type: "boolean" },
      outdir: { type: "string", default: join(HERE, "dist") },
    },
  });

  const named = values.target ?? [];
  const unknown = named.filter((name) => !isTarget(name));

  if (unknown.length > 0)
    fail(`unknown target: ${unknown.join(", ")}\ntargets: ${TARGETS.join(", ")}`);

  const targets = values.all ? TARGETS : named.length > 0 ? named.filter(isTarget) : [undefined];

  const version = manifest("svjeez").version;
  const outdir = resolve(values.outdir);
  const started = performance.now();

  await pack(version);
  console.log(
    `packed types, libs and the skill in ${((performance.now() - started) / 1000).toFixed(1)}s`,
  );

  const sums: string[] = [];

  for (const target of targets) {
    const outfile = await compile(version, target, outdir);
    const size = statSync(outfile).size / 1024 / 1024;
    const sum = createHash("sha256").update(readFileSync(outfile)).digest("hex");

    sums.push(`${sum}  ${basename(outfile)}`);
    console.log(
      `✓ ${relative(process.cwd(), outfile) || basename(outfile)}  ${size.toFixed(1)} MB`,
    );
  }

  // install.sh checks a download against this, in the format of sha256sum and shasum -a 256.
  await writeFile(join(outdir, "svjeez-checksums.txt"), `${sums.join("\n")}\n`);
}
