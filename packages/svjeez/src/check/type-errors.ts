import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type * as TS from "typescript";
import type { Problem } from "./inspect-context";

/** Explains a diagnostic with a fix; returns undefined to fall back to the generic one. */
export type Hint = (diagnostic: TS.Diagnostic, message: string) => string | undefined;

const COLORS =
  'Colors are hex literals: write "#RRGGBB" where it is used, mark the array or object that holds them `as const`, or type it as Color from svjeez.';

const fixFor = (diagnostic: TS.Diagnostic, message: string, hint?: Hint): string => {
  const given = hint?.(diagnostic, message);

  if (given) return given;

  if (
    message.includes("`#${string}`") ||
    /Type 'string' is not assignable to type '[^']*\b(Paint|Color)\b/.test(message)
  )
    return COLORS;

  if (diagnostic.code === 7006 || diagnostic.code === 7031) return "Give the parameter a type.";

  return "Change it to the type the message names.";
};

/**
 * The program's errors in the scene's own files (not declarations or node_modules, and only under within when
 * given), as check problems.
 */
export const typeErrors = (
  ts: typeof TS,
  program: TS.Program,
  hint?: Hint,
  within?: string,
): readonly Problem[] => {
  const own = program
    .getSourceFiles()
    .filter(
      (source) =>
        !source.isDeclarationFile &&
        !source.fileName.includes("/node_modules/") &&
        (within === undefined || source.fileName.startsWith(within)),
    );

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
      fix: fixFor(diagnostic, message, hint),
    };
  });
};

const FALLBACK = {
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
} as const;

type Api = Partial<typeof TS>;

const isCompiler = (value: Api): value is typeof TS =>
  value.createProgram !== undefined && value.findConfigFile !== undefined;

/** The TypeScript installed beside the scene, if any. */
const typescriptFor = async (file: string): Promise<typeof TS | undefined> => {
  try {
    const url = pathToFileURL(createRequire(file).resolve("typescript")).href;
    const loaded: Api & { readonly default?: Api } = await import(/* @vite-ignore */ url);
    const api = loaded.default ?? loaded;

    // TypeScript 7 is a native binary with no JavaScript API to check with.
    return isCompiler(api) ? api : undefined;
  } catch {
    return undefined;
  }
};

/**
 * Type errors in a scene and the local files it imports, checked the way the project's editor would: with the
 * tsconfig.json found above the scene, or strict defaults when there is none. Undefined when TypeScript is not
 * installed beside the scene.
 */
export const projectTypeProblems = async (
  file: string,
): Promise<readonly Problem[] | undefined> => {
  const path = resolve(file);
  const ts = await typescriptFor(path);

  if (!ts) return undefined;

  const config = ts.findConfigFile(dirname(path), (name) => existsSync(name));

  const options: TS.CompilerOptions = config
    ? ts.parseJsonConfigFileContent(
        ts.readConfigFile(config, ts.sys.readFile).config,
        ts.sys,
        dirname(config),
      ).options
    : ts.convertCompilerOptionsFromJson(FALLBACK, dirname(path)).options;

  const program = ts.createProgram({ rootNames: [path], options: { ...options, noEmit: true } });

  return typeErrors(ts, program, undefined, `${config ? dirname(config) : dirname(path)}/`);
};
