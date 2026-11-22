import type { SyntaxNode } from "@lezer/common";
import { parser as js } from "@lezer/javascript";
import { TICK } from "./guard.ts";

const parser = js.configure({ dialect: "jsx ts" });

/** Names a scene has no business with: each one reaches the host's globals or compiles code from a string. */
const ESCAPES: ReadonlySet<string> = new Set([
  "eval",
  "Function",
  "require",
  "globalThis",
  "process",
]);

/** The compiler's own names, such as the loop guard's `__svzTick`: a scene that declared one could switch its guard off. */
const RESERVED_PREFIX = "__svz";

/** Every node that spells a name: a variable, a binding, a property, a label, an import or export alias. */
const RESERVED: ReadonlySet<string> = new Set([
  "VariableName",
  "VariableDefinition",
  "PropertyName",
  "PropertyDefinition",
  "Label",
  "JSXIdentifier",
]);

const COMMENTS: ReadonlySet<string> = new Set(["LineComment", "BlockComment"]);

/** One change to a file's text: `from` to `to` becomes `text`. An insert has `from` equal to `to`. */
export interface Change {
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

export interface Specifier {
  /** The module named, without quotes. */
  readonly name: string;
  /** The quoted string in the source. */
  readonly from: number;
  readonly to: number;
}

export interface Escape {
  readonly at: number;
  readonly message: string;
}

/** What a file's text says about itself, without running it. */
export interface Analysis {
  readonly imports: readonly Specifier[];
  readonly escapes: readonly Escape[];
  /** Inserts that make each loop count its iterations. */
  readonly guards: readonly Change[];
}

/** The module an import, or an `export … from`, names. A bare `export default "text"` names none. */
const specifierOf = (source: string, declaration: SyntaxNode): Specifier | undefined => {
  if (declaration.name === "ExportDeclaration" && !declaration.getChild("from")) return undefined;

  for (let child = declaration.firstChild; child; child = child.nextSibling)
    if (child.name === "String")
      return { name: source.slice(child.from + 1, child.to - 1), from: child.from, to: child.to };

  return undefined;
};

/** The statement a loop repeats. */
const bodyOf = (loop: SyntaxNode): SyntaxNode | undefined => {
  if (loop.name !== "DoStatement") return loop.lastChild ?? undefined;
  let body = loop.firstChild?.nextSibling;

  while (body && COMMENTS.has(body.name)) body = body.nextSibling;

  return body ?? undefined;
};

const isStatement = (node: SyntaxNode): boolean =>
  node.name === "Block" || node.name.endsWith("Statement");

const TICKS = `${TICK}();`;

/** A loop's body starts with a tick. A body that is a single statement gets braces to hold it, and a bare `;` becomes the block. */
const guardsOf = (loop: SyntaxNode): readonly Change[] => {
  const body = bodyOf(loop);

  if (body?.name === ";") return [{ from: body.from, to: body.to, text: `{${TICKS}}` }];

  if (!body || !isStatement(body)) return [];

  if (body.name === "Block") return [{ from: body.from + 1, to: body.from + 1, text: TICKS }];

  return [
    { from: body.from, to: body.from, text: `{${TICKS}` },
    { from: body.to, to: body.to, text: "}" },
  ];
};

const LOOPS: ReadonlySet<string> = new Set(["ForStatement", "WhileStatement", "DoStatement"]);

/**
 * Reads a file for its imports, the names it must not use and the loops that need a guard. Pass JavaScript with its
 * types already erased: whatever import is left runs, so `import type from "./mod"`, a default import named `type`,
 * is seen for what it is, and `import type { T }` is gone.
 */
export const analyze = (source: string): Analysis => {
  const imports: Specifier[] = [];
  const escapes: Escape[] = [];
  const guards: Change[] = [];

  parser.parse(source).iterate({
    enter: (ref) => {
      const text = () => source.slice(ref.from, ref.to);

      if (ref.name === "ImportDeclaration" || ref.name === "ExportDeclaration") {
        const found = specifierOf(source, ref.node);

        if (found) imports.push(found);
      } else if (ref.name === "DynamicImport")
        escapes.push({
          at: ref.from,
          message:
            "import() loads code the compiler never saw. Write an import at the top of the file.",
        });
      else if (ref.name === "VariableName" && ESCAPES.has(text()))
        escapes.push({
          at: ref.from,
          message: `${text()} reaches outside the scene, which a scene may not do.`,
        });
      else if (RESERVED.has(ref.name) && text().startsWith(RESERVED_PREFIX))
        escapes.push({
          at: ref.from,
          message: `Names starting with ${RESERVED_PREFIX} belong to the compiler, which a scene may not use.`,
        });
      else if (
        (ref.name === "PropertyName" || ref.name === "PropertyDefinition") &&
        text() === "__proto__"
      )
        escapes.push({
          at: ref.from,
          message: "__proto__ rewrites the prototype of a shared object, which a scene may not do.",
        });
      else if (LOOPS.has(ref.name)) guards.push(...guardsOf(ref.node));
    },
  });

  return { imports, escapes, guards };
};

/** The text with every change made. The changes may arrive in any order, and none overlap. */
export const applied = (source: string, changes: readonly Change[]): string =>
  changes
    .toSorted((a, b) => b.from - a.from)
    .reduce((text, c) => text.slice(0, c.from) + c.text + text.slice(c.to), source);

/** A character offset as a 1-based line and column. */
export interface Place {
  readonly line: number;
  readonly col: number;
}

export const placeOf = (source: string, offset: number): Place => {
  const before = source.slice(0, offset);
  const line = before.split("\n").length;

  return { line, col: offset - (before.lastIndexOf("\n") + 1) + 1 };
};
