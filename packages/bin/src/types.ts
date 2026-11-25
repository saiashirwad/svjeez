import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { Problem } from "svjeez/tools";
import { typeErrors, type Hint } from "svjeez/typecheck";
import type * as TS from "typescript";
import { assets, type Assets } from "./assets";

const cacheRoot = (): string =>
  join(process.env.XDG_CACHE_HOME || join(homedir(), ".cache"), "svjeez", "bin");

/** Writes files under dir, whole: into a sibling first, then renamed in, so a reader never sees half of them. */
const unpack = async (dir: string, files: Readonly<Record<string, string>>): Promise<void> => {
  const staging = `${dir}.${process.pid}.tmp`;

  await rm(staging, { recursive: true, force: true });

  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(staging, path)), { recursive: true });
    await writeFile(join(staging, path), text);
  }

  await mkdir(dirname(dir), { recursive: true });
  await rename(staging, dir).catch(async (error: NodeJS.ErrnoException) => {
    await rm(staging, { recursive: true, force: true });

    if (!existsSync(dir)) throw error;
  });
};

const prefixed = (
  prefix: string,
  files: Readonly<Record<string, string>>,
): Record<string, string> =>
  Object.fromEntries(Object.entries(files).map(([path, text]) => [`${prefix}/${path}`, text]));

/** The cache folder holding types/ and lib/ for this build of the binary, unpacked on first use. */
export const unpacked = async (): Promise<{ readonly dir: string; readonly assets: Assets }> => {
  const given = await assets();
  const dir = join(cacheRoot(), given.hash);

  if (!existsSync(join(dir, "types")))
    await unpack(dir, {
      ...prefixed("types", given.types),
      ...prefixed("lib", given.libs),
      ...prefixed("node_modules", given.node),
    });

  return { dir, assets: given };
};

/** The paths that send each module a scene can import to its declaration file under types/. */
export const pathsFor = (given: Assets, types: string): Record<string, string[]> =>
  Object.fromEntries(
    Object.entries(given.specifiers).map(([specifier, path]) => [specifier, [join(types, path)]]),
  );

/** The compiler options a scene is checked with: strict, without noUncheckedIndexedAccess's noise for scene code. */
export const COMPILER_OPTIONS = {
  target: "ESNext",
  module: "ESNext",
  moduleResolution: "bundler",
  allowImportingTsExtensions: true,
  resolveJsonModule: true,
  jsx: "react-jsx",
  jsxImportSource: "svjeez",
  strict: true,
  skipLibCheck: true,
  noEmit: true,
  lib: ["ESNext", "DOM"],
  types: ["node"],
} as const;

const hint =
  (carried: readonly string[]): Hint =>
  (diagnostic) =>
    diagnostic.code === 2307
      ? `The svjeez binary carries ${carried.join(", ")}; any other package needs a node_modules beside the scene.`
      : undefined;

let typescript: Promise<typeof TS> | undefined;

/** Type errors in a scene file and the local files it imports, as check problems. */
export const typeProblems = async (file: string): Promise<readonly Problem[]> => {
  const ts = await (typescript ??= import("typescript").then((module) => module.default));
  const { dir, assets: given } = await unpacked();
  const lib = join(dir, "lib");

  const options: TS.CompilerOptions = {
    ...ts.convertCompilerOptionsFromJson(COMPILER_OPTIONS, dirname(file)).options,
    paths: pathsFor(given, join(dir, "types")),
    typeRoots: [join(dir, "node_modules", "@types")],
  };

  const host = ts.createCompilerHost(options);
  host.getDefaultLibLocation = () => lib;
  host.getDefaultLibFileName = (chosen) => join(lib, ts.getDefaultLibFileName(chosen));

  const program = ts.createProgram({ rootNames: [resolve(file)], options, host });

  const carried = Object.keys(given.specifiers).filter(
    (name) => name === "svjeez" || /^@svjeez\/[^/]+$/.test(name),
  );

  return typeErrors(ts, program, hint(carried));
};

const forward = (folder: string, path: string): string =>
  `./${relative(folder, path).split("\\").join("/")}`;

/** A tsconfig.json for a folder of scenes, pointing at the types init copies into folder/.svjeez. */
export const tsconfigFor = (given: Assets, folder: string, home: string) => ({
  compilerOptions: {
    ...COMPILER_OPTIONS,
    typeRoots: [forward(folder, join(home, "node_modules", "@types"))],
    paths: Object.fromEntries(
      Object.entries(pathsFor(given, join(home, "types"))).map(([specifier, [path]]) => [
        specifier,
        [forward(folder, path!)],
      ]),
    ),
  },
  include: ["**/*.ts", "**/*.tsx"],
  exclude: [".svjeez", "node_modules"],
});
