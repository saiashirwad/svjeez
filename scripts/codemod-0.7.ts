// Rewrites a project's source for svjeez 0.7: the import moves (svjeez/extras, svjeez/voxel and the params control math
// now live in svjeez and the @svjeez packages) and the renames (Values, sample, sampledPath, Steady, Pivot at, voxel
// block at, flow loop, fieldFlow, renderVideo and the icon type), and the time model: during, cut, visible, tl.show and
// tl.enter become show(), sampled and globe duration become over, a voxel block's from and to become show, and the .end
// of a typewriter, terminal, reveal or flow result becomes .span.end.
//
//   bun codemod-0.7.ts [--dry] <file or folder>...
//
// It reads source as text, with strings and comments set aside, so it needs nothing installed. It rewrites .ts, .tsx,
// .mts, .cts, .js, .jsx and .mjs files and skips node_modules and dist folders. Run your formatter afterwards: a moved
// import gets a line of its own, and two imports of one package are not merged. What it cannot rewrite safely it
// prints as a warning with the file and line.
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const DIAGRAMS = new Set([
  "Anchor",
  "Diagram",
  "DiagramOptions",
  "Labelled",
  "NodeRole",
  "flowchart",
  "Flowchart",
  "FlowchartOptions",
  "FlowchartEdge",
  "FlowchartGroup",
  "sequence",
  "Sequence",
  "SequenceMessage",
  "SequenceOptions",
  "lanes",
  "Lanes",
  "LanesOptions",
  "LaneEvent",
  "LaneLink",
  "LaneSpan",
  "tree",
  "Tree",
  "TreeOptions",
  "TreeSpec",
  "stateMachine",
  "Checked",
  "StateIds",
  "StateMachine",
  "StateOptions",
  "StateSpec",
  "WalkToken",
  "Transition",
  "Walk",
]);

/** What svjeez/extras exported that is now in @svjeez/math, under the name it has there. */
const MATH = new Map([
  ["Area", "CalculusArea"],
  ["AreaOptions", "CalculusAreaOptions"],
  ["Curve", "CalculusCurve"],
  ["CurveOptions", "CalculusCurveOptions"],
  ["Dot", "CalculusDot"],
  ["DotOptions", "CalculusDotOptions"],
  ["Line", "CalculusLine"],
  ["LineOptions", "CalculusLineOptions"],
  ["MorphCurveOptions", "CalculusMorphOptions"],
  ...[
    "axes",
    "Axes",
    "AxesOptions",
    "Plot",
    "PlotOptions",
    "Calculus",
    "Moving",
    "Riemann",
    "RiemannOptions",
    "Sweep",
    "contours",
    "contourSweep",
    "fieldFlow",
    "fieldLines",
    "slopeField",
    "slopeSolution",
    "streamlines",
    "vectorField",
    "FieldArrow",
    "Bounds",
    "ContourLevel",
    "ContourLine",
    "ContourOptions",
    "ContourSweep",
    "ContourSweepOptions",
    "FieldFlowOptions",
    "FieldLinesOptions",
    "Grid",
    "SlopeFieldOptions",
    "SlopeFieldResult",
    "SlopeSolution",
    "SolutionOptions",
    "Streamlines",
    "StreamlinesOptions",
    "VectorField",
    "VectorFieldOptions",
    "VectorFieldResult",
  ].map((name): [string, string] => [name, name]),
]);

const PALETTES = new Set([
  "tomorrowNight",
  "tomorrow",
  "solarizedDark",
  "solarizedLight",
  "gruvboxDark",
  "gruvboxLight",
]);

const LIVE = new Set(["fit", "positionOf", "valueAt", "fitValues", "withValues", "follow"]);

type Rewrite = "path" | "steady" | "fieldFlow" | "during" | "cut" | "visible";

interface Spot {
  readonly module: string;
  readonly name: string;
  /** What else in the file has to change for this name, beyond the name itself. */
  readonly rewrite?: Rewrite;
}

/** Where an import from the module called name is found now. */
const moved = (module: string, name: string): Spot => {
  if (module === "svjeez/voxel") return { module: "@svjeez/voxel", name };

  if (module === "svjeez/params") return { module: LIVE.has(name) ? "@svjeez/live" : module, name };

  if (module !== "svjeez/extras") return { module, name };

  if (DIAGRAMS.has(name)) return { module: "@svjeez/diagrams", name };
  const math = MATH.get(name);

  if (math) return { module: "@svjeez/math", name: math };

  return { module: PALETTES.has(name) ? "@svjeez/code" : "svjeez", name };
};

const RENAMES = new Map<string, Spot>([
  ["svjeez Values", { module: "svjeez", name: "ChannelValues" }],
  ["svjeez sample", { module: "svjeez", name: "valuesAt" }],
  ["svjeez SampleOptions", { module: "svjeez", name: "ValuesAtOptions" }],
  ["svjeez sampledPath", { module: "svjeez", name: "sampled", rewrite: "path" }],
  ["svjeez Steady", { module: "svjeez", name: "Camera", rewrite: "steady" }],
  ["@svjeez/math fieldFlow", { module: "svjeez", name: "flow", rewrite: "fieldFlow" }],
  ["@svjeez/math FieldFlowOptions", { module: "svjeez", name: "FlowOptions" }],
  ["svjeez during", { module: "svjeez", name: "show", rewrite: "during" }],
  ["svjeez cut", { module: "svjeez", name: "show", rewrite: "cut" }],
  ["svjeez visible", { module: "svjeez", name: "show", rewrite: "visible" }],
  ["@svjeez/video renderVideo", { module: "@svjeez/video", name: "video" }],
  ["@svjeez/icons Icon", { module: "@svjeez/icons", name: "IconData" }],
]);

/** The 0.7 names for names that kept their package. */
const renamed = (spot: Spot): Spot => RENAMES.get(spot.module + " " + spot.name) ?? spot;

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

interface Binding {
  readonly local: string;
  readonly from: string;
  readonly to: Spot;
  readonly aliased: boolean;
}

export interface Result {
  readonly text: string;
  readonly warnings: readonly string[];
}

const EXTENSIONS = new Set([".ts", ".mts", ".cts", ".tsx", ".js", ".mjs", ".jsx"]);

/** Same length as source, with the inside of strings, template text and comments blanked, so patterns find code only. */
const mask = (source: string): string => {
  const out = [...source];

  const blank = (from: number, to: number): void => {
    for (let i = from; i < to; i++) if (out[i] !== "\n") out[i] = " ";
  };

  const braces: number[] = [];
  let i = 0;

  while (i < source.length) {
    const c = source[i]!;
    const next = source[i + 1];

    if (c === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end < 0 ? source.length : end;
      blank(i, stop);
      i = stop;
    } else if (c === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? source.length : end + 2;
      blank(i, stop);
      i = stop;
    } else if (c === '"' || c === "'") {
      let j = i + 1;

      while (j < source.length && source[j] !== c && source[j] !== "\n")
        j += source[j] === "\\" ? 2 : 1;
      blank(i + 1, j);
      i = j + 1;
    } else if (c === "`" || (c === "}" && braces.at(-1) === 0)) {
      if (c === "}") braces.pop();
      let j = i + 1;

      while (
        j < source.length &&
        source[j] !== "`" &&
        !(source[j] === "$" && source[j + 1] === "{")
      )
        j += source[j] === "\\" ? 2 : 1;
      blank(i + 1, j);

      if (source[j] === "$") {
        braces.push(0);
        i = j + 2;
      } else i = j + 1;
    } else {
      if (c === "{" && braces.length > 0) braces[braces.length - 1]!++;

      if (c === "}" && braces.length > 0) braces[braces.length - 1]!--;
      i++;
    }
  }

  return out.join("");
};

const PAIRS = new Map([
  ["(", ")"],
  ["[", "]"],
  ["{", "}"],
]);

/** The index of the bracket that closes the one at open, or -1. */
const closing = (code: string, open: number): number => {
  let depth = 0;

  for (let i = open; i < code.length; i++) {
    if (PAIRS.has(code[i]!)) depth++;
    else if ([...PAIRS.values()].includes(code[i]!) && --depth === 0) return i;
  }

  return -1;
};

/** The pieces of code from..to between commas that sit at its own level, as [start, end]. */
const pieces = (code: string, from: number, to: number): [number, number][] => {
  const out: [number, number][] = [];
  let [depth, start] = [0, from];

  for (let i = from; i < to; i++) {
    if (PAIRS.has(code[i]!)) depth++;
    else if ([...PAIRS.values()].includes(code[i]!)) depth--;
    else if (code[i] === "," && depth === 0) {
      out.push([start, i]);
      start = i + 1;
    }
  }

  out.push([start, to]);

  return out;
};

/** What a piece of an object literal or an attribute list is called: its key, and where the key sits. */
const keyOf = (
  code: string,
  [start, end]: [number, number],
): { name: string; at: number; shorthand: boolean } | undefined => {
  const found = /^\s*([\w$]+)\s*(:|$)/.exec(code.slice(start, end));

  return found
    ? { name: found[1]!, at: start + found[0].indexOf(found[1]!), shorthand: found[2] === "" }
    : undefined;
};

const word = (name: string): RegExp =>
  new RegExp("(?<![\\w$.])" + name.replaceAll("$", "\\$") + "(?![\\w$])(?!\\s*:(?!:))", "g");

/** Rewrites one file's source, as the 0.7 codemod does. */
export const rewrite = (fileName: string, source: string): Result => {
  const code = mask(source);
  const edits: Edit[] = [];
  const warnings: string[] = [];
  const bindings: Binding[] = [];
  const handled: [number, number][] = [];

  const warn = (index: number, message: string): void => {
    const line = source.slice(0, index).split("\n").length;
    warnings.push(fileName + ":" + line + ": " + message);
  };

  const edit = (start: number, end: number, text: string): void => {
    edits.push({ start, end, text });
  };

  const inImport = (index: number): boolean => handled.some(([a, b]) => index >= a && index < b);
  const IMPORT = /\bimport\s+(type\s+)?\{([^}]*)\}\s*from\s*(["'])([^"']+)\3[ \t]*;?/g;
  const matches = [...source.matchAll(IMPORT)].filter((m) => code.startsWith("import", m.index));

  const taken = new Set(
    matches.flatMap((m) =>
      m[2]!.split(",").map((s) =>
        s
          .trim()
          .split(/\s+as\s+/)
          .at(-1)!
          .replace(/^type\s+/, ""),
      ),
    ),
  );

  const outside = [...code]
    .map((c, i) => (matches.some((m) => i >= m.index && i < m.index + m[0].length) ? " " : c))
    .join("");

  const taking = (name: string): boolean => word(name).test(outside);

  for (const match of matches) {
    const [whole, typeKeyword, list, quote, module] = [
      match[0],
      match[1],
      match[2]!,
      match[3]!,
      match[4]!,
    ];

    const start = match.index;
    const groups = new Map<string, string[]>();
    let changed = false;
    let readable = true;

    for (const piece of list
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)) {
      const found = /^(type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?$/.exec(piece);

      if (!found) {
        readable = false;
        break;
      }

      const [type, from, alias] = [found[1], found[2]!, found[3]];
      const spot = renamed(moved(module, from));
      const unchanged = spot.module === module && spot.name === from;
      const newName = !alias && spot.name !== from;
      const duplicate = newName && taken.has(spot.name);
      const collides = newName && !spot.rewrite && taking(spot.name);
      const keepName = alias !== undefined || collides;

      const text = unchanged
        ? piece
        : (type ?? "") + spot.name + (keepName ? " as " + (alias ?? from) : "");

      const group = groups.get(spot.module) ?? [];

      if (!unchanged) changed = true;

      if (!(duplicate && !collides) && !group.includes(text)) group.push(text);
      groups.set(spot.module, group);
      bindings.push({ local: alias ?? from, from, to: spot, aliased: keepName });
    }

    if (!readable) {
      warn(start, "could not read this import. Move " + module + " names by hand.");
      continue;
    }

    handled.push([start, start + whole.length]);

    if (!changed) continue;
    const import_ = typeKeyword ? "import type" : "import";

    const lines = [...groups].flatMap(([target, names]) =>
      names.length > 0
        ? [import_ + " { " + names.join(", ") + " } from " + quote + target + quote + ";"]
        : [],
    );

    const end =
      start + whole.length + (lines.length === 0 && source[start + whole.length] === "\n" ? 1 : 0);

    edit(start, end, lines.join("\n"));
  }

  const find = (predicate: (b: Binding) => boolean): Binding | undefined =>
    bindings.find(predicate);

  const pivot = find((b) => b.to.module === "svjeez" && b.to.name === "Pivot");
  const voxel = find((b) => b.to.module === "@svjeez/voxel" && b.to.name === "voxel");
  const flow = find((b) => b.to.module === "svjeez" && b.to.name === "flow" && b.local === "flow");
  const path = find((b) => b.to.rewrite === "path");
  const steady = find((b) => b.to.rewrite === "steady");
  const fieldFlow = find((b) => b.to.rewrite === "fieldFlow");

  for (const special of [path, steady, fieldFlow])
    if (special?.aliased)
      warn(
        0,
        special.local + " is an alias of " + special.from + ", so its uses need rewriting by hand.",
      );

  for (const b of bindings)
    if (!b.aliased && !b.to.rewrite && b.to.name !== b.from)
      for (const m of code.matchAll(word(b.from)))
        if (!inImport(m.index)) edit(m.index, m.index + b.from.length, b.to.name);

  if (path && !path.aliased)
    for (const m of code.matchAll(word(path.local)))
      if (!inImport(m.index)) edit(m.index, m.index + m[0].length, "sampled.path");

  /** Renames the attribute from to name on the element whose tag name ends at open. */
  const attribute = (open: number, from: string, to: string): void => {
    let depth = 0;

    for (let i = open; i < code.length; i++) {
      if (code[i] === "{") depth++;
      else if (code[i] === "}") depth--;
      else if (depth === 0 && code[i] === ">") return;
      else if (depth === 0 && code.startsWith(from + "=", i) && /\s/.test(code[i - 1] ?? ""))
        edit(i, i + from.length, to);
    }
  };

  if (steady && !steady.aliased) {
    for (const m of code.matchAll(new RegExp("<Steady(?![\\w$.])", "g"))) {
      edit(m.index + 1, m.index + 7, "Camera steady");
      attribute(m.index + 7, "at", "origin");
    }

    for (const m of code.matchAll(/<\/Steady\s*>/g)) edit(m.index + 2, m.index + 8, "Camera");

    for (const m of code.matchAll(word("Steady")))
      if (
        !inImport(m.index) &&
        code[m.index - 1] !== "<" &&
        code.slice(m.index - 2, m.index) !== "</"
      )
        warn(
          m.index,
          "Steady is used other than as a JSX element. Rewrite it as <Camera steady origin={…}>.",
        );
  }

  if (pivot)
    for (const m of code.matchAll(new RegExp("<" + pivot.local + "(?![\\w$.])", "g")))
      attribute(m.index + 1 + pivot.local.length, "at", "origin");

  if (fieldFlow && !fieldFlow.aliased)
    for (const m of code.matchAll(
      new RegExp("(?<![\\w$.])" + fieldFlow.local + "(?=\\s*\\()", "g"),
    )) {
      if (inImport(m.index)) continue;
      const open = code.indexOf("(", m.index);
      const close = closing(code, open);
      edit(m.index, m.index + m[0].length, "flow");

      if (close >= 0) edit(close + 1, close + 1, ".node");
    }

  if (flow)
    for (const m of code.matchAll(new RegExp("(?<![\\w$.])flow(?=\\s*\\()", "g"))) {
      const open = code.indexOf("(", m.index);
      const close = closing(code, open);
      const second = close < 0 ? undefined : pieces(code, open + 1, close)[1];
      const brace = second ? code.indexOf("{", second[0]) : -1;

      if (!second || brace < 0 || brace >= second[1] || code.slice(second[0], brace).trim() !== "")
        continue;

      for (const piece of pieces(code, brace + 1, closing(code, brace))) {
        const key = keyOf(code, piece);

        if (key?.name === "loop")
          edit(key.at, key.at + 4, key.shorthand ? "period: loop" : "period");
      }
    }

  /** The calls of local( as [name start, argument pieces, close]. */
  const calls = (local: string): [number, [number, number][], number][] =>
    [
      ...code.matchAll(
        new RegExp("(?<![\\w$.])" + local.replaceAll(".", "\\.") + "(?=\\s*\\()", "g"),
      ),
    ].flatMap((m) => {
      if (inImport(m.index)) return [];
      const open = code.indexOf("(", m.index);
      const close = closing(code, open);

      return close < 0 ? [] : [[m.index, pieces(code, open + 1, close), close]];
    });

  const trimmed = ([a, b]: [number, number]): string => source.slice(a, b).trim();
  let usesShow = bindings.some((b) => b.to.module === "svjeez" && b.to.name === "show");

  for (const b of bindings.filter(
    (x) => x.to.rewrite === "during" || x.to.rewrite === "cut" || x.to.rewrite === "visible",
  )) {
    if (b.aliased) {
      warn(
        0,
        b.local + " is an alias of " + b.from + ", so its uses need rewriting to show() by hand.",
      );
      continue;
    }

    for (const [at, args, close] of calls(b.local)) {
      edit(at, at + b.local.length, "show");

      if (b.to.rewrite === "cut") edit(args[0]![1], args[0]![1], ", { fade: 0 }");
      else if (args[1] && trimmed(args[1]) !== "") {
        const lead = /^\s*/.exec(source.slice(args[1][0], args[1][1]))![0];
        edit(args[1][0], args[1][1], lead + "{ fade: " + trimmed(args[1]) + " }");
      }

      if (b.to.rewrite === "visible")
        warn(
          at,
          "visible() faded outside its spans and show() fades inside them, so check the timing.",
        );
      void close;
    }
  }

  const hasTimeline = bindings.some((b) => b.to.module === "svjeez" && b.to.name === "timeline");

  const timelines = [
    ...code.matchAll(/\b(?:const|let|var)\s+([\w$]+)\s*=\s*(?:await\s+)?timeline\s*\(/g),
  ].flatMap((m) => (hasTimeline ? [m[1]!] : []));

  for (const name of timelines)
    for (const m of code.matchAll(
      new RegExp("(?<![\\w$.])" + name + "\\.(show|enter)\\s*\\(", "g"),
    )) {
      const open = m.index + m[0].length - 1;
      const close = closing(code, open);
      const arg = source.slice(open + 1, close).trim();

      if (close < 0 || arg === "") continue;
      const scene = /^(["'])([\w$]+)\1$/.exec(arg);
      const at = scene ? name + "." + scene[2] : name + "[" + arg + "]";
      edit(
        m.index,
        close + 1,
        m[1] === "show" ? "show(" + at + ")" : "show({ at: " + at + ".at })",
      );
      usesShow = true;
    }

  const results = bindings.flatMap((b) =>
    b.to.module === "svjeez" && ["typewriter", "terminal", "reveal", "flow"].includes(b.to.name)
      ? [b.local]
      : [],
  );

  for (const local of results)
    for (const m of code.matchAll(
      new RegExp(
        "\\b(?:const|let|var)\\s+([\\w$]+)\\s*=\\s*(?:await\\s+)?" + local + "\\s*\\(",
        "g",
      ),
    ))
      for (const use of code.matchAll(new RegExp("(?<![\\w$.])" + m[1] + "\\.end(?![\\w$])", "g")))
        edit(use.index + m[1]!.length + 1, use.index + m[1]!.length + 4, "span.end");

  const windowed = (local: string, which: number): void => {
    for (const [, args] of calls(local)) {
      const options = args[which];
      const brace = options ? code.indexOf("{", options[0]) : -1;

      if (
        !options ||
        brace < 0 ||
        brace >= options[1] ||
        code.slice(options[0], brace).trim() !== ""
      )
        continue;

      for (const piece of pieces(code, brace + 1, closing(code, brace))) {
        const key = keyOf(code, piece);

        if (key?.name === "duration")
          edit(key.at, key.at + 8, key.shorthand ? "over: duration" : "over");
      }
    }
  };

  for (const b of bindings) {
    if (b.to.module === "svjeez" && b.to.name === "sampled" && !b.to.rewrite && !b.aliased) {
      windowed(b.local, 1);
      windowed(b.local + ".path", 1);
    }

    if (b.to.rewrite === "path" && !b.aliased) windowed(b.local, 1);

    if (b.to.module === "@svjeez/geo" && b.to.name === "globe") windowed(b.local, 1);

    if (b.to.module === "@svjeez/geo" && b.to.name === "nightfall") windowed(b.local, 2);
  }

  if (voxel) {
    const open: number[] = [];
    let renamedCells = 0;

    for (let i = 0; i < code.length; i++) {
      if (code[i] === "{") open.push(i);
      else if (code[i] === "}" && open.length > 0) {
        const from = open.pop()!;
        const parts = pieces(code, from + 1, i);
        const keys = parts.flatMap((p) => keyOf(code, p) ?? []);

        if (keys.some((k) => k.name === "skin")) {
          const start = parts.findIndex((p) => keyOf(code, p)?.name === "from");
          const stop = parts.findIndex((p) => keyOf(code, p)?.name === "to");

          const valueOf = (index: number): string => {
            const piece = parts[index]!;
            const text = source.slice(piece[0], piece[1]);

            return /^\s*[\w$]+\s*$/.test(text)
              ? text.trim()
              : text.slice(text.indexOf(":") + 1).trim();
          };

          if (start >= 0 || stop >= 0) {
            const numeric = (text: string): boolean => /^\d+(\.\d+)?$/.test(text);
            const [a, b] = [start >= 0 ? valueOf(start) : "0", stop >= 0 ? valueOf(stop) : ""];

            const over =
              b === ""
                ? ""
                : numeric(a) && numeric(b)
                  ? String(Math.round((Number(b) - Number(a)) * 1e9) / 1e9)
                  : a === "0"
                    ? b
                    : b + " - " + a;

            const text = "show: { at: " + a + (over === "" ? "" : ", over: " + over) + " }";
            const first = start >= 0 ? start : stop;
            const old = source.slice(parts[first]![0], parts[first]![1]);
            edit(
              parts[first]![0],
              parts[first]![1],
              /^\s*/.exec(old)![0] + text + /\s*$/.exec(old)![0],
            );

            if (start >= 0 && stop >= 0) {
              const last = stop === parts.length - 1;
              const [from, to] = parts[stop]!;
              const trimmedEnd = from + source.slice(from, to).trimEnd().length;
              edit(last ? from - 1 : from, last ? trimmedEnd : to + 1, "");
            }
          }

          const cell = keys.find((k) => k.name === "at");

          if (cell) {
            edit(cell.at, cell.at + 2, cell.shorthand ? "cell: at" : "cell");
            renamedCells++;
          }
        }
      }
    }

    if (renamedCells === 0)
      for (const m of code.matchAll(
        new RegExp("(?<![\\w$.])" + voxel.local + "\\.scene\\s*\\(", "g"),
      ))
        warn(m.index, "a voxel block's at is now cell. Rename it where the blocks are built.");
  }

  if (usesShow && !bindings.some((b) => b.to.module === "svjeez" && b.to.name === "show")) {
    const last = Math.max(0, ...matches.map((m) => m.index + m[0].length));
    edit(last, last, '\nimport { show } from "svjeez";');
  }

  const text = [...edits]
    .sort((a, b) => b.start - a.start || b.end - a.end)
    .reduce((out, e) => out.slice(0, e.start) + e.text + out.slice(e.end), source);

  for (const m of text.matchAll(/(?<![\w@/])svjeez\/(extras|voxel)\b/g))
    warn(
      m.index,
      'still mentions "' + m[0] + '". Import its names from the packages they moved to.',
    );

  return { text, warnings };
};

const SKIPPED = new Set(["node_modules", "dist", "package-dist", ".git", ".astro", ".svelte-kit"]);

const sourcesIn = (path: string): string[] => {
  if (statSync(path).isFile()) return EXTENSIONS.has(extname(path)) ? [path] : [];

  return readdirSync(path).flatMap((name) =>
    SKIPPED.has(name) ? [] : sourcesIn(join(path, name)),
  );
};

export interface Run {
  readonly changed: readonly string[];
  readonly warnings: readonly string[];
}

/** Rewrites every source file under paths, in place unless dry. Returns the files it changed or would change. */
export const run = (paths: readonly string[], dry = false): Run => {
  const changed: string[] = [];
  const warnings: string[] = [];

  for (const file of paths.flatMap(sourcesIn)) {
    const source = readFileSync(file, "utf8");
    const result = rewrite(file, source);
    warnings.push(...result.warnings);

    if (result.text === source) continue;
    changed.push(file);

    if (!dry) writeFileSync(file, result.text);
  }

  return { changed, warnings };
};

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  const args = process.argv.slice(2);
  const dry = args.includes("--dry");
  const paths = args.filter((a) => a !== "--dry");
  const result = run(paths.length > 0 ? paths : ["."], dry);
  const verb = dry ? "would change" : "changed";

  for (const file of result.changed) console.log(verb + " " + file);

  for (const warning of result.warnings) console.warn("warning: " + warning);
  console.log(
    result.changed.length + " file" + (result.changed.length === 1 ? " " : "s ") + verb + ".",
  );
}
