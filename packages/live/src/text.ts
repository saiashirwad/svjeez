import type { Attribute, Json } from "./types.ts";

export const isString = (value: Json | undefined): value is string => typeof value === "string";
export const isNumber = (value: Json | undefined): value is number => typeof value === "number";
const isBoolean = (value: Json | undefined): value is boolean => typeof value === "boolean";

const isObject = (value: Json | undefined): value is { readonly [key: string]: Json } =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** 32-bit FNV-1a over UTF-16 code units, as 8 hex digits. Synchronous, so it works wherever the parser does. */
export const hash = (text: string): string => {
  let h = 0x811c9dc5;

  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);

  return (h >>> 0).toString(16).padStart(8, "0");
};

const ESCAPES = new Map([
  ["n", "\n"],
  ["r", "\r"],
  ["t", "\t"],
  ["b", "\b"],
  ["f", "\f"],
  ["v", "\v"],
  ["0", "\0"],
]);

/** What a JS string literal's body holds, escapes read. */
export const unescape = (body: string): string =>
  body.replace(
    /\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|(\r\n|[\s\S]))/g,
    (all, braced?: string, four?: string, two?: string, one?: string) => {
      const code = braced ?? four ?? two;

      if (code !== undefined) {
        const point = Number.parseInt(code, 16);

        return point <= 0x10ffff ? String.fromCodePoint(point) : all;
      }

      if (one === "\n" || one === "\r\n" || one === "\r") return "";

      return ESCAPES.get(one ?? "") ?? one ?? "";
    },
  );

const ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", "\u00a0"],
  ["copy", "\u00a9"],
  ["reg", "\u00ae"],
  ["trade", "\u2122"],
  ["hellip", "\u2026"],
  ["mdash", "\u2014"],
  ["ndash", "\u2013"],
  ["lsquo", "\u2018"],
  ["rsquo", "\u2019"],
  ["ldquo", "\u201c"],
  ["rdquo", "\u201d"],
  ["bull", "\u2022"],
  ["middot", "\u00b7"],
  ["times", "\u00d7"],
  ["deg", "\u00b0"],
  ["euro", "\u20ac"],
]);

/** What a JSX attribute string holds: no backslash escapes, but HTML entities are read. */
export const entities = (body: string): string =>
  body.replace(
    /&(?:#x([0-9a-fA-F]+)|#(\d+)|(\w+));/g,
    (all, hex?: string, dec?: string, name?: string) => {
      const point =
        hex !== undefined ? Number.parseInt(hex, 16) : dec !== undefined ? Number(dec) : undefined;

      if (point !== undefined) return point <= 0x10ffff ? String.fromCodePoint(point) : all;

      return ENTITIES.get(name ?? "") ?? all;
    },
  );

const JS_ESCAPES = new Map([
  ['"', '\\"'],
  ["\\", "\\\\"],
  ["\n", "\\n"],
  ["\r", "\\r"],
  ["\t", "\\t"],
]);

const needsUnicode = (c: string) => {
  const code = c.charCodeAt(0);

  return code < 0x20 || code === 0x7f || code === 0x2028 || code === 0x2029 || "<>&".includes(c);
};

/** A double-quoted JS string. `<`, `>` and `&` are written as `\u…` so the text is safe in any markup it lands in. */
export const jsString = (value: string): string => {
  let out = '"';

  for (const c of value)
    out +=
      JS_ESCAPES.get(c) ??
      (needsUnicode(c) ? `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}` : c);

  return `${out}"`;
};

/** A JSX attribute string takes its text as it is, so anything JSX or HTML would read differently goes in `{"…"}` instead. */
const plainInAttribute = (value: string, quote: string) => {
  for (const c of value)
    if (c === quote || c === "\\" || c === "{" || c === "}" || needsUnicode(c)) return false;

  return true;
};

export const PROTOTYPE_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;
const MAX_DEPTH = 32;

/** A value as JS source, or why it can't be written. Prototype keys, non-finite numbers and anything not JSON are refused. */
export const jsValue = (
  value: Json,
  depth = 0,
): { readonly text: string } | { readonly issue: string } => {
  if (depth > MAX_DEPTH) return { issue: "the value nests too deeply" };

  if (isString(value)) return { text: jsString(value) };

  if (isNumber(value))
    return Number.isFinite(value) ? { text: String(value) } : { issue: "a number must be finite" };

  if (isBoolean(value)) return { text: String(value) };

  if (value === null) return { text: "null" };

  if (Array.isArray(value)) {
    const parts: string[] = [];

    for (const item of value) {
      const written = jsValue(item, depth + 1);

      if ("issue" in written) return written;
      parts.push(written.text);
    }

    return { text: `[${parts.join(", ")}]` };
  }

  if (isObject(value)) {
    const parts: string[] = [];

    for (const [key, item] of Object.entries(value)) {
      if (PROTOTYPE_KEYS.has(key)) return { issue: `the key "${key}" is not allowed` };
      const written = jsValue(item, depth + 1);

      if ("issue" in written) return written;
      parts.push(`${IDENTIFIER.test(key) ? key : jsString(key)}: ${written.text}`);
    }

    return { text: parts.length ? `{ ${parts.join(", ")} }` : "{}" };
  }

  return { issue: "the value is not JSON" };
};

const EASE = /^ease\.(?:linear|in|out|inOut|pop|bezier\(\s*-?[\d.]+(?:\s*,\s*-?[\d.]+){3}\s*\))$/;

/** What follows `name` for `value`: `="x"` when JSX would read it back unchanged, else `={…}`. */
export const attributeValue = (
  value: Json,
  previous?: Attribute,
): { readonly text: string } | { readonly issue: string } => {
  if (isString(value)) {
    if (previous?.kind === "literal" && previous.lit === "ease" && EASE.test(value))
      return { text: `={${value}}` };

    const first =
      previous?.kind === "literal" && previous.form === "string" ? previous.text[0] : undefined;

    const quote = first === "'" ? "'" : '"';

    return plainInAttribute(value, quote)
      ? { text: `=${quote}${value}${quote}` }
      : { text: `={${jsString(value)}}` };
  }

  const written = jsValue(value);

  return "issue" in written ? written : { text: `={${written.text}}` };
};

/** A unified diff of one file, as a single hunk with three lines of context. Empty when nothing changed. */
export const unified = (file: string, before: string, after: string): string => {
  if (before === after) return "";
  const a = lines(before);
  const b = lines(after);
  let start = 0;

  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  let endA = a.length;
  let endB = b.length;

  while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
    endA--;
    endB--;
  }

  const from = Math.max(0, start - 3);
  const toA = Math.min(a.length, endA + 3);
  const toB = Math.min(b.length, endB + 3);

  const body = [
    ...a.slice(from, start).map((l) => ` ${l}`),
    ...a.slice(start, endA).map((l) => `-${l}`),
    ...b.slice(start, endB).map((l) => `+${l}`),
    ...a.slice(endA, toA).map((l) => ` ${l}`),
  ];

  const head = `@@ -${toA - from ? from + 1 : from},${toA - from} +${toB - from ? from + 1 : from},${toB - from} @@`;

  return [`--- a/${file}`, `+++ b/${file}`, head, ...body].join("\n") + "\n";
};

const lines = (text: string) => {
  const out = text.split("\n");

  if (out.at(-1) === "") out.pop();

  return out;
};
