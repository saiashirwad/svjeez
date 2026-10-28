// Reads the upstream SVG files of @tabler/icons and lucide-static from node_modules and writes src/tabler.ts and
// src/lucide.ts, one `export const name: Icon` per icon. Rerunning it produces no diff.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Icon } from "../src/icon.ts";

const ROOT = join(import.meta.dirname, "..");

const upstream = (name: string): string => {
  const found = [join(ROOT, "node_modules", name), join(ROOT, "../../node_modules", name)].find(
    (dir) => existsSync(join(dir, "package.json")),
  );

  if (!found) throw new Error(`${name} is not installed; run bun install`);

  return found;
};

const RESERVED = new Set(
  (
    "arguments await break case catch class const continue debugger default delete do else enum eval export extends " +
    "false finally for function if implements import in instanceof interface let new null package private protected " +
    "public return static super switch this throw true try typeof var void while with yield undefined NaN Infinity"
  ).split(" "),
);

/**
 * `arrow-left` is `arrowLeft`. A hyphen between two digits is an underscore, so `arrow-up-1-0` is `arrowUp1_0` and
 * stays apart from `arrow-up-10`. A name that is not an identifier, or is reserved, gets an `icon` prefix: `iconDelete`. */
export const exportName = (file: string): string => {
  const camel = file
    .replace(/(?<=\d)-(?=\d)/g, "_")
    .replace(/-+([a-z0-9])/g, (_, c: string) => c.toUpperCase());

  return /^[A-Za-z_$][\w$]*$/.test(camel) && !RESERVED.has(camel)
    ? camel
    : `icon${camel[0]!.toUpperCase()}${camel.slice(1)}`;
};

const num = (value: number): string => String(Math.round(value * 1000) / 1000);

type Attrs = Readonly<Record<string, string>>;

/** The only attributes an element may carry, besides the paint attributes every element may. */
const GEOMETRY = new Map([
  ["path", ["d"]],
  ["circle", ["cx", "cy", "r"]],
  ["ellipse", ["cx", "cy", "rx", "ry"]],
  ["rect", ["x", "y", "width", "height", "rx", "ry"]],
  ["line", ["x1", "y1", "x2", "y2"]],
  ["polyline", ["points"]],
  ["polygon", ["points"]],
]);

const PAINT = ["fill", "stroke"];

/** Attributes that change how an icon looks but not its shape, accepted for one icon and dropped. */
const DROPPED = new Map([["brand-parsinta", ["opacity"]]]);

const points = (attrs: Attrs): readonly (readonly [number, number])[] => {
  const n = attrs
    .points!.trim()
    .split(/[\s,]+/)
    .map(Number);

  if (n.length % 2 || n.some(Number.isNaN)) throw new Error(`bad points "${attrs.points}"`);

  return Array.from({ length: n.length / 2 }, (_, i) => [n[2 * i]!, n[2 * i + 1]!] as const);
};

const toPath = (tag: string, attrs: Attrs): string => {
  const a = (name: string, fallback?: number): number => {
    const raw = attrs[name];
    const value = raw === undefined ? fallback : Number(raw);

    if (value === undefined || Number.isNaN(value))
      throw new Error(`<${tag}> needs a number ${name}`);

    return value;
  };

  switch (tag) {
    case "path":
      return attrs.d!;

    case "circle": {
      const [cx, cy, r] = [a("cx", 0), a("cy", 0), a("r")];

      return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0`;
    }

    case "ellipse": {
      const [cx, cy, rx, ry] = [a("cx", 0), a("cy", 0), a("rx"), a("ry")];

      return `M${num(cx - rx)} ${num(cy)}a${num(rx)} ${num(ry)} 0 1 0 ${num(2 * rx)} 0a${num(rx)} ${num(ry)} 0 1 0 ${num(-2 * rx)} 0`;
    }

    case "rect": {
      const [x, y, w, h] = [a("x", 0), a("y", 0), a("width"), a("height")];
      const rx = Math.min(a("rx", a("ry", 0)), w / 2);
      const ry = Math.min(a("ry", a("rx", 0)), h / 2);

      if (rx === 0 || ry === 0) return `M${num(x)} ${num(y)}h${num(w)}v${num(h)}h${num(-w)}z`;

      const corner = (dx: number, dy: number) =>
        `a${num(rx)} ${num(ry)} 0 0 1 ${num(dx)} ${num(dy)}`;

      return (
        `M${num(x + rx)} ${num(y)}h${num(w - 2 * rx)}${corner(rx, ry)}v${num(h - 2 * ry)}${corner(-rx, ry)}` +
        `h${num(2 * rx - w)}${corner(-rx, -ry)}v${num(2 * ry - h)}${corner(rx, -ry)}z`
      );
    }

    case "line":
      return `M${num(a("x1", 0))} ${num(a("y1", 0))}L${num(a("x2", 0))} ${num(a("y2", 0))}`;

    case "polyline":
    case "polygon": {
      const d = points(attrs)
        .map(([x, y], i) => `${i ? "L" : "M"}${num(x)} ${num(y)}`)
        .join("");

      return tag === "polygon" ? `${d}z` : d;
    }

    default:
      throw new Error(`unknown element <${tag}>`);
  }
};

const ATTR = /([\w:-]+)\s*=\s*"([^"]*)"/g;

const attributes = (source: string): Attrs =>
  Object.fromEntries([...source.matchAll(ATTR)].map(([, name, value]) => [name!, value!]));

interface Parsed {
  readonly icon: Icon;
  /** The icon draws a solid piece inside an outline icon; it is stroked like the rest. */
  readonly mixed: boolean;
}

/** `root` is what the file's <svg> must say: the paint of the whole icon. */
function parse(file: string, svg: string, kind: Icon["kind"]): Parsed {
  const clean = svg.replace(/<!--[\s\S]*?-->/g, "");
  const root = clean.match(/<svg\b([^>]*)>/);

  if (!root) throw new Error("no <svg>");

  const rootAttrs = attributes(root[1]!);
  const box = (rootAttrs.viewBox ?? "").split(/\s+/).map(Number);

  if (box.length !== 4 || box[0] !== 0 || box[1] !== 0 || box[2] !== box[3] || !(box[2]! > 0))
    throw new Error(`viewBox "${rootAttrs.viewBox}" is not a square from the origin`);

  const rootPaint =
    kind === "fill" ? { fill: "currentColor" } : { fill: "none", stroke: "currentColor" };

  for (const [name, value] of Object.entries(rootPaint))
    if (rootAttrs[name] !== value) throw new Error(`<svg> ${name} is "${rootAttrs[name]}"`);

  if (kind === "stroke" && rootAttrs["stroke-width"] !== "2")
    throw new Error(`stroke-width is "${rootAttrs["stroke-width"]}"`);

  const body = clean.slice(clean.indexOf(">", root.index) + 1);
  const paths: string[] = [];
  let mixed = false;

  for (const [, tag, source] of body.matchAll(/<([a-zA-Z]+)\b([^>]*?)\/?>/g)) {
    const attrs = attributes(source!);
    const allowed = [...(GEOMETRY.get(tag!) ?? []), ...PAINT, ...(DROPPED.get(file) ?? [])];
    const stray = Object.keys(attrs).filter((name) => !allowed.includes(name));

    if (!GEOMETRY.has(tag!)) throw new Error(`unknown element <${tag}>`);

    if (stray.length) throw new Error(`<${tag}> has ${stray.join(", ")}`);

    if (attrs.stroke === "none" && attrs.fill === "none") continue;

    if (kind === "stroke" && attrs.fill !== undefined && attrs.fill !== "none") mixed = true;

    paths.push(toPath(tag!, attrs));
  }

  if (!paths.length) throw new Error("no paths");

  return { icon: { grid: box[2]!, kind, paths }, mixed };
}

interface Source {
  /** The upstream npm package, which names the generated header. */
  readonly pkg: string;
  readonly out: string;
  /** Folders of SVG files and the kind of icon each holds, with the suffix their names take. */
  readonly folders: readonly {
    readonly dir: string;
    readonly kind: Icon["kind"];
    readonly suffix: string;
  }[];
}

const SOURCES: readonly Source[] = [
  {
    pkg: "@tabler/icons",
    out: "tabler.ts",
    folders: [
      { dir: "icons/outline", kind: "stroke", suffix: "" },
      { dir: "icons/filled", kind: "fill", suffix: "-filled" },
    ],
  },
  {
    pkg: "lucide-static",
    out: "lucide.ts",
    folders: [{ dir: "icons", kind: "stroke", suffix: "" }],
  },
];

interface Generated {
  readonly count: number;
  readonly mixed: readonly string[];
}

function generate({ pkg, out, folders }: Source): Generated {
  const base = upstream(pkg);
  const version: string = JSON.parse(readFileSync(join(base, "package.json"), "utf8")).version;
  const license = readFileSync(join(base, "LICENSE"), "utf8").trimEnd();

  if (license.includes("*/")) throw new Error(`${pkg} LICENSE contains a comment terminator`);

  const icons = new Map<string, { readonly file: string; readonly icon: Icon }>();
  const mixed: string[] = [];
  const problems: string[] = [];

  for (const { dir, kind, suffix } of folders) {
    for (const file of readdirSync(join(base, dir)).filter((f) => f.endsWith(".svg"))) {
      const id = file.slice(0, -4);
      const name = exportName(`${id}${suffix}`);

      try {
        const parsed = parse(id, readFileSync(join(base, dir, file), "utf8"), kind);
        const taken = icons.get(name);

        if (taken) throw new Error(`name ${name} is also ${taken.file}`);

        icons.set(name, { file: `${dir}/${file}`, icon: parsed.icon });

        if (parsed.mixed) mixed.push(`${dir}/${file}`);
      } catch (error) {
        problems.push(
          `${pkg} ${dir}/${file}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  if (problems.length) throw new Error(`${problems.length} icons failed:\n${problems.join("\n")}`);

  const lines = [...icons.keys()]
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => {
      const { grid, kind, paths } = icons.get(name)!.icon;

      return `export const ${name}: Icon = { grid: ${grid}, kind: ${JSON.stringify(kind)}, paths: ${JSON.stringify(paths)} };`;
    });

  const header = [
    "/**",
    ` * Generated by scripts/generate.ts from ${pkg}@${version}. Do not edit.`,
    " *",
    ...license.split("\n").map((line) => (line ? ` * ${line}` : " *")),
    " */",
  ];

  writeFileSync(
    join(ROOT, "src", out),
    `${header.join("\n")}\nimport type { Icon } from "./icon.ts";\n\n${lines.join("\n")}\n`,
  );

  return { count: icons.size, mixed };
}

if (import.meta.main) {
  for (const source of SOURCES) {
    const { count, mixed } = generate(source);

    console.log(`${source.pkg}: ${count} icons to src/${source.out}`);

    if (mixed.length)
      console.log(`  ${mixed.length} outline icons hold a solid piece, stroked like the rest`);
  }
}
