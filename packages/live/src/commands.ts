import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { ease, type Ease, type Hex } from "svjeez";
import type { Schema } from "svjeez/params";
import { paramFor, valuesOf, type Settable, type Value } from "./controls.ts";
import { editFor } from "./editor.ts";
import { apply, parse, type Edit, type Source } from "./source.ts";

/** One value as `svjeez values` lists it. */
export interface Listed {
  readonly key: string;
  readonly kind: Value["kind"];
  /** The value: a number, a color's hex, an ease as code, a choice's option. */
  readonly value: number | string;
  /** The literal as written in the file. */
  readonly text: string;
  readonly label: string;
  readonly line: number;
  readonly column: number;
  /** A number's range: `declared` by the scene's params, else guessed from where the number sits. */
  readonly range?: {
    readonly min: number;
    readonly max: number;
    readonly step: number;
    readonly unit?: string;
    readonly declared: boolean;
  };
  readonly options?: readonly string[];
  /** The longest a text param's line may be, when it says. */
  readonly maxLength?: number;
}

const declaredNumber = (value: Value, schema: Schema) =>
  value.kind === "number" &&
  !!value.literal.param &&
  !value.literal.param.option &&
  schema[value.literal.param.key]?.kind === "number";

/** Every value the editor shows a control for, with where it is and what it can be. */
export const listValues = (source: Source, schema: Schema = {}): Listed[] =>
  valuesOf(source, schema).map((value) => {
    const line = source.lineAt(value.literal.range[0]);
    const column = value.literal.range[0] - source.lineStart(line) + 1;

    const base = {
      key: value.key,
      kind: value.kind,
      text: value.literal.text,
      label: value.label,
      line,
      column,
    };

    switch (value.kind) {
      case "number": {
        const { min, max, step, unit } = value.param;

        return {
          ...base,
          value: value.literal.value,
          range: { min, max, step, ...(unit && { unit }), declared: declaredNumber(value, schema) },
        };
      }

      case "color":
        return { ...base, value: value.literal.value };
      case "ease":
        return { ...base, value: value.literal.text };
      case "choice":
        return { ...base, value: value.literal.value, options: value.options };
      case "text":
        return {
          ...base,
          value: value.literal.value,
          ...(value.maxLength !== undefined && { maxLength: value.maxLength }),
        };
    }
  });

const distance = (a: string, b: string) => {
  let row = Array.from({ length: b.length + 1 }, (_, j) => j);

  for (let i = 1; i <= a.length; i++) {
    const next = [i];

    for (let j = 1; j <= b.length; j++)
      next[j] = Math.min(
        row[j]! + 1,
        next[j - 1]! + 1,
        row[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    row = next;
  }

  return row[b.length]!;
};

/** The `count` keys closest to `key`: those that hold it or share its last part first, then by edit distance. */
export const nearestKeys = (key: string, keys: readonly string[], count = 5): string[] => {
  const last = (k: string) => k.split(/[.:#]/).filter(Boolean).at(-1) ?? k;

  const score = (k: string) =>
    distance(key, k) -
    (k.includes(key) || key.includes(k) ? 100 : 0) -
    (last(k) === last(key) ? 50 : 0);

  return [...keys].sort((a, b) => score(a) - score(b)).slice(0, count);
};

const COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const NAMED = ["linear", "in", "out", "inOut", "pop"] as const;

const isHex = (text: string): text is Hex => COLOR.test(text);

type Read<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly why: string };

/** An ease from `out`, `ease.out`, `bezier(0.2, 0, 0, 1)`, `ease.bezier(…)` or four bare numbers. */
const readEase = (raw: string): Read<Ease> => {
  const text = raw.trim().replace(/^ease\./, "");
  const named = NAMED.find((n) => n === text);

  if (named) return { ok: true, value: ease[named] };
  const inner = /^bezier\((.*)\)$/s.exec(text)?.[1] ?? text;
  const points = inner.split(",").map((n) => (n.trim() === "" ? NaN : Number(n)));
  const [x1, y1, x2, y2] = points;

  if (
    points.length !== 4 ||
    x1 === undefined ||
    y1 === undefined ||
    x2 === undefined ||
    y2 === undefined ||
    points.some((n) => !Number.isFinite(n))
  )
    return {
      ok: false,
      why: `is not an ease. Write a name (${NAMED.join(", ")}) or bezier(x1, y1, x2, y2).`,
    };

  if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1)
    return {
      ok: false,
      why: "is a bezier whose x1 or x2 is outside 0 to 1, which CSS rejects. Keep both x values in 0 to 1.",
    };

  return { ok: true, value: ease.bezier(x1, y1, x2, y2) };
};

/** The edit that writes `v` into `value`, to the literal's own precision rather than a drag step's. */
const written = <V extends Value>(value: V, v: Settable[V["kind"]]): Read<Edit> => {
  const edit = editFor(value, v, { step: false });

  return edit ? { ok: true, value: edit } : { ok: false, why: "has no code to write." };
};

/**
 * The edit that writes `raw`, the text after `key=`, into `value`'s literal, read as the kind of value it is, or why
 * it isn't one. A number a scene declares in its params must fall in the declared range, since the scene's own checks
 * would reject it. A number is written with as many decimals as it needs and its literal had, so `over: 1.2` set to 2
 * reads `over: 2.0` and set to 0.75 reads `over: 0.75`.
 */
export const readSetting = (value: Value, raw: string, schema: Schema = {}): Read<Edit> => {
  const fails = (why: string): Read<Edit> => ({ ok: false, why });

  switch (value.kind) {
    case "number": {
      const v = raw.trim() === "" ? NaN : Number(raw.replaceAll("_", ""));

      if (!Number.isFinite(v))
        return fails(`is not a number. Pass one, as in ${value.key}=${value.literal.text}.`);
      const { min, max } = value.param;
      const param = value.literal.param?.key;

      if (declaredNumber(value, schema) && (v < min || v > max))
        return fails(
          `is outside params.${param}'s range, ${min} to ${max}. Pick a value in it, or widen it first with params.${param}.min or params.${param}.max.`,
        );

      return written(value, v);
    }

    case "color":
      return isHex(raw)
        ? written(value, raw)
        : fails("is not a color. Write a hex: #rgb, #rrggbb or #rrggbbaa.");
    case "ease": {
      const read = readEase(raw);

      return read.ok ? written(value, read.value) : read;
    }

    case "choice":
      return value.options.includes(raw)
        ? written(value, raw)
        : fails(`is not one of ${value.key}'s options: ${value.options.join(", ")}.`);
    case "text":
      return value.maxLength !== undefined && raw.length > value.maxLength
        ? fails(
            `is ${raw.length} characters, over ${value.key}'s maxLength of ${value.maxLength}. Shorten it.`,
          )
        : written(value, raw);
  }
};

/** The values `set` can write: every control's, and a number param's own `min`, `max` and `step`, to widen a range. */
const settable = (source: Source, schema: Schema): Value[] => [
  ...valuesOf(source, schema),
  ...source.literals.flatMap((literal): Value[] =>
    literal.kind === "number" && literal.param?.option !== undefined
      ? [
          {
            kind: "number",
            key: literal.key,
            literal,
            label: literal.key,
            param: paramFor(literal),
          },
        ]
      : [],
  ),
];

export interface Change {
  readonly key: string;
  readonly from: string;
  readonly to: string;
  readonly line: number;
  readonly column: number;
}

export interface Revision {
  readonly text: string;
  readonly changes: readonly Change[];
  /** Keys that name a different literal after the edit, as `[before, after]`, in source order. */
  readonly shifted: readonly (readonly [string, string])[];
}

/** Thrown for a key or value the caller has to fix, with the message to show. */
export class SetError extends Error {
  override name = "SetError";
}

/**
 * `text` with each `key=value` written in, all against the file as it was, so one key's edit never moves another's.
 * Throws a SetError naming every key that isn't there and every value that doesn't fit its kind.
 */
export const setValues = (
  text: string,
  settings: readonly (readonly [key: string, raw: string])[],
  schema: Schema = {},
): Revision => {
  const source = parse(text);
  const values = settable(source, schema);
  const byKey = new Map(values.map((v) => [v.key, v]));
  const shown = valuesOf(source, schema).map((v) => v.key);
  const errors: string[] = [];
  const edits: (Edit & { key: string; from: string })[] = [];
  const seen = new Set<string>();

  for (const [key, raw] of settings) {
    const value = byKey.get(key);

    if (seen.has(key)) {
      errors.push(`${key} is set twice. Pass each key once.`);
      continue;
    }

    seen.add(key);

    if (!value) {
      errors.push(`No value has the key ${key}. Nearest: ${nearestKeys(key, shown).join(", ")}.`);
      continue;
    }

    const read = readSetting(value, raw, schema);

    if (read.ok) edits.push({ ...read.value, key, from: value.literal.text });
    else errors.push(`${key}=${raw} ${read.why}`);
  }

  if (errors.length) throw new SetError(errors.join("\n"));
  const next = apply(text, edits);
  const after = parse(next).literals;

  const changes = edits
    .map(({ key, from, text: to, range }) => {
      const line = source.lineAt(range[0]);

      return { key, from, to, line, column: range[0] - source.lineStart(line) + 1 };
    })
    .sort((a, b) => a.line - b.line || a.column - b.column);

  const shifted =
    after.length === source.literals.length
      ? source.literals.flatMap((l, i): (readonly [string, string])[] =>
          after[i]!.key === l.key ? [] : [[l.key, after[i]!.key]],
        )
      : [["(every key)", `${source.literals.length} literals became ${after.length}`] as const];

  return { text: next, changes: changes.filter((c) => c.from !== c.to), shifted };
};

/** The changed lines of `before`, each as `-` and `+` under its `file:line`. Set edits never add or remove a line. */
export const diffOf = (
  file: string,
  before: string,
  after: string,
  lines: readonly number[],
): string => {
  const was = before.split("\n");
  const now = after.split("\n");

  return [...new Set(lines)]
    .sort((a, b) => a - b)
    .map((n) => `${file}:${n}\n- ${was[n - 1]}\n+ ${now[n - 1]}`)
    .join("\n");
};

const isSchema = (value: unknown): value is Schema =>
  value instanceof Object && Object.values(value).every((p) => p instanceof Object && "kind" in p);

/** Loads the module, through tsx on Node when the file is TypeScript, as svjeez's own CLI does. */
const importScene = async (path: string): Promise<{ params?: unknown }> => {
  const url = pathToFileURL(path).href;

  return import(url).catch(async (error: Error & { code?: string }) => {
    if (error.code !== "ERR_UNKNOWN_FILE_EXTENSION") throw error;

    const tsx = (() => {
      try {
        return pathToFileURL(
          createRequire(join(process.cwd(), "package.json")).resolve("tsx/esm/api"),
        ).href;
      } catch {
        return "tsx/esm/api";
      }
    })();

    const { register }: { register: () => void } = await import(tsx);
    register();

    return import(url);
  });
};

/**
 * The scene's params schema, read by running the module, which is the only way to know a param's declared range. A
 * file that declares no params is not run. When the module will not load, ranges are guessed, and `note` says why.
 */
const schemaOf = async (
  path: string,
  source: Source,
): Promise<{ schema: Schema; note?: string }> => {
  if (!source.literals.some((l) => l.param)) return { schema: {} };

  try {
    const module = await importScene(path);

    return isSchema(module.params) ? { schema: module.params } : { schema: {} };
  } catch (error) {
    const why = error instanceof Error ? error.message.split("\n")[0] : String(error);

    return {
      schema: {},
      note: `could not load the module to read its params (${why}), so their ranges are guessed`,
    };
  }
};

const readScene = async (file: string) => {
  const path = resolve(file);

  const text = await readFile(path, "utf8").catch(() => {
    throw new SetError(`${file}: no such file. Pass the scene's .tsx or .ts file.`);
  });

  if (file.endsWith(".svg"))
    throw new SetError(`${file} is an SVG. Pass the scene module that made it.`);

  return { path, text, source: parse(text) };
};

const show = (listed: Listed): string => {
  if (listed.range) {
    const { min, max, step, unit = "", declared } = listed.range;

    return `${min}..${max}${unit} step ${step}${declared ? " (declared)" : ""}`;
  }

  if (listed.options) return `one of ${listed.options.join(" | ")}`;

  return listed.maxLength === undefined ? "" : `at most ${listed.maxLength} characters`;
};

const table = (rows: readonly (readonly string[])[]) => {
  const widths = rows[0]?.map((_, i) => Math.max(...rows.map((r) => r[i]!.length))) ?? [];

  return rows
    .map((r) =>
      r
        .map((cell, i) => (i < r.length - 1 ? cell.padEnd(widths[i]!) : cell))
        .join("  ")
        .trimEnd(),
    )
    .join("\n");
};

const POSITIONAL =
  "A key ending in #N counts literals held the same way in that declaration, so adding or removing one before it renumbers it. Run svjeez values again after editing the source by hand.";

/** `svjeez values <scene> [--json] [--filter text]`. Resolves the exit code. */
export const values = async (args: string[]): Promise<number> => {
  const { values: flags, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { json: { type: "boolean" }, filter: { type: "string" } },
  });

  const file = positionals[0];

  if (!file) throw new SetError("usage: svjeez values <scene.tsx> [--json] [--filter text]");
  const { path, source } = await readScene(file);
  const { schema, note } = await schemaOf(path, source);
  const filter = flags.filter?.toLowerCase();

  const listed = listValues(source, schema).filter(
    (v) => !filter || [v.key, v.label, v.text].some((s) => s.toLowerCase().includes(filter)),
  );

  if (flags.json) {
    console.log(JSON.stringify({ file, values: listed, ...(note && { note }) }, null, 2));

    return 0;
  }

  console.log(
    table(
      listed.map((v) => [`${file}:${v.line}:${v.column}`, v.key, v.kind, String(v.value), show(v)]),
    ),
  );

  console.log(
    `${listed.length} value${listed.length === 1 ? "" : "s"}${filter ? ` matching "${flags.filter}"` : ""}. Set one with svjeez set ${file} key=value.${note ? `\nnote: ${note}.` : ""}`,
  );

  return 0;
};

/** `svjeez set <scene> key=value … [--dry-run]`. Resolves the exit code. */
export const set = async (args: string[]): Promise<number> => {
  const { values: flags, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: { "dry-run": { type: "boolean" } },
  });

  const [file, ...pairs] = positionals;

  if (!file || !pairs.length)
    throw new SetError("usage: svjeez set <scene.tsx> key=value [key=value ...] [--dry-run]");

  const settings = pairs.map((pair) => {
    const equals = pair.indexOf("=");

    if (equals < 1)
      throw new SetError(
        `${pair} is not key=value. Write it as default:circle.r=12, keys as svjeez values lists them.`,
      );

    return [pair.slice(0, equals), pair.slice(equals + 1)] as const;
  });

  const { path, text, source } = await readScene(file);
  const { schema, note } = await schemaOf(path, source);
  const revision = setValues(text, settings, schema);
  const dry = flags["dry-run"];

  if (!revision.changes.length) {
    console.log(`${file}: every value already reads that way; nothing to write.`);

    return 0;
  }

  if (!dry) await writeFile(path, revision.text);

  console.log(revision.changes.map((c) => `${c.key}  ${c.from} -> ${c.to}`).join("\n"));
  console.log(
    diffOf(
      file,
      text,
      revision.text,
      revision.changes.map((c) => c.line),
    ),
  );
  const n = revision.changes.length;
  console.log(
    `${dry ? "would set" : "set"} ${n} value${n === 1 ? "" : "s"} in ${file}${dry ? " (dry run, nothing written)" : ""}.`,
  );

  if (revision.shifted.length)
    console.log(
      `keys shifted: ${revision.shifted.map(([a, b]) => `${a} is now ${b}`).join(", ")}. Run svjeez values again before the next set.`,
    );
  else console.log("keys unchanged.");

  if (settings.some(([key]) => /#\d+$/.test(key))) console.log(`note: ${POSITIONAL}`);

  if (note) console.log(`note: ${note}.`);

  return 0;
};
