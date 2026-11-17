import { init, parse } from "es-module-lexer/js";
import { transform, type Options } from "sucrase";

import { at, type CompileError } from "./error";

/** A scene turned into JavaScript, with the specifiers it imports. */
export interface Transpiled {
  readonly js: string;
  readonly imports: readonly string[];
}

const OPTIONS: Options = {
  transforms: ["typescript", "jsx"],
  jsxRuntime: "automatic",
  jsxImportSource: "svjeez",
  production: true,
};

const lineOf = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Where sucrase reports a parse error: "Unexpected token (3:13)", line and 1-based column. */
const POSITION = /^(.*) \((\d+):(\d+)\)$/s;

/**
 * Transpiles a scene with sucrase, which keeps every line where it was, and lists what it imports. Every import
 * must be in `allowed`, or the error names the line and the list. Sucrase drops an import the scene never uses as a
 * value, as TypeScript does for a type-only one, so the check reads the imports from a pass that keeps them all.
 */
export const transpile = async (
  source: string,
  allowed: readonly string[],
): Promise<Transpiled | CompileError> => {
  let js: string;
  let every: string;

  try {
    js = transform(source, OPTIONS).code;
    every = transform(source, { ...OPTIONS, keepUnusedImports: true }).code;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const [, text = message, line, column] = POSITION.exec(message) ?? [];

    return at(
      source,
      "syntax",
      text,
      line ? Number(line) : undefined,
      column ? Number(column) : undefined,
    );
  }

  await init();

  const lines = source.split("\n");

  for (const found of parse(every)[0]) {
    // import.meta loads nothing.
    if (found.type === "import-meta") continue;

    const line = lineOf(every, found.importStart);
    const specifier = found.type === "dynamic" && found.glob ? undefined : found.specifier;

    if (specifier !== undefined && allowed.includes(specifier)) continue;

    const column =
      specifier === undefined ? undefined : lines[line - 1]!.indexOf(specifier) + 1 || undefined;

    return at(
      source,
      "import",
      specifier === undefined
        ? "import() needs a string literal here, so the service can tell what the scene loads."
        : `"${specifier}" is not available here. A scene can import only: ${allowed.join(", ")}. Relative imports and other files do not exist; the scene is one file.`,
      line,
      column,
    );
  }

  const imports = parse(js)[0].flatMap((found) => (found.specifier ? [found.specifier] : []));

  return { js, imports: [...new Set(imports)] };
};
