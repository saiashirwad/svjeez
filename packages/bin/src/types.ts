import { existsSync } from "node:fs";
import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import type { Problem } from "svjeez/tools";
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
    // Another process unpacked the same files first.
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

const hint = (diagnostic: TS.Diagnostic, message: string, carried: readonly string[]): string => {
  if (
    message.includes("`#${string}`") ||
    /Type 'string' is not assignable to type '[^']*\b(Paint|Color)\b/.test(message)
  )
    return 'Colors are hex literals: write "#RRGGBB" where it is used, mark the array or object that holds them `as const`, or type it as Color from svjeez.';

  const written =
    diagnostic.file && diagnostic.start !== undefined
      ? diagnostic.file.text.slice(diagnostic.start, diagnostic.start + (diagnostic.length ?? 0))
      : "";

  if (written === "key")
    return "A key is text: write key={`dot-${i}`}, or key={String(i)}, not a bare number.";

  if (diagnostic.code === 2307)
    return `The svjeez binary carries ${carried.join(", ")}; any other package needs a node_modules beside the scene.`;

  if (diagnostic.code === 7006 || diagnostic.code === 7031) return "Give the parameter a type.";

  return "Change it to the type the message names.";
};

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

  const own = program
    .getSourceFiles()
    .filter((source) => !source.isDeclarationFile && !source.fileName.includes("/node_modules/"));

  const diagnostics = [
    ...program.getOptionsDiagnostics(),
    ...program.getGlobalDiagnostics(),
    ...own.flatMap((source) => [
      ...program.getSyntacticDiagnostics(source),
      ...program.getSemanticDiagnostics(source),
    ]),
  ];

  return diagnostics.map((diagnostic): Problem => {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n  ");

    const at =
      diagnostic.file && diagnostic.start !== undefined
        ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start)
        : undefined;

    return {
      code: "type-error",
      severity: "error",
      key: "",
      ...(diagnostic.file &&
        at && {
          source: { file: diagnostic.file.fileName, line: at.line + 1, column: at.character + 1 },
        }),
      message: `TS${diagnostic.code}: ${message}`,
      fix: hint(diagnostic, message, carried),
    };
  });
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
