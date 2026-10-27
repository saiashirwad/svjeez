import { attributeName } from "./attributes";
import { isRef, type AnyRef } from "./defs";
import { isFontValue, type FontValue } from "./font/font";
import { escapeAttr, escapeText, kebab, num, significant } from "./format";
import { isMotion, type Motion } from "./motion";
import { compactPath } from "./pathdata";
import { Css, formatProperty, isProperty, type CssPart } from "./properties";

export type Child = SvgNode | string | number | boolean | null | undefined | readonly Child[];

export type AttrValue = string | AnyRef | Css | FontValue;

export type SvgNode =
  | {
      readonly kind: "element";
      readonly tag: string;
      readonly attrs: Readonly<Record<string, AttrValue>>;
      readonly children: readonly SvgNode[];
      /** The `animation` stack, outermost first. Never serialized. */
      readonly motions: readonly Motion[];
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "raw"; readonly value: string }
  | { readonly kind: "fragment"; readonly children: readonly SvgNode[] };

export type Element = Extract<SvgNode, { kind: "element" }>;

const TEXT_TAGS = new Set(["text", "tspan", "title", "desc"]);
const RAW_TEXT_TAGS = new Set(["style"]);

export const element = (
  tag: string,
  attrs: Readonly<Record<string, AttrValue>> = {},
  children: readonly SvgNode[] = [],
  motions: readonly Motion[] = [],
): Element => ({ kind: "element", tag, attrs, children, motions });

export const raw = (value: string): SvgNode => ({ kind: "raw", value });

export const children = (input: unknown, preserveWhitespace = false): SvgNode[] => {
  const out: SvgNode[] = [];
  const visit = (value: unknown): void => {
    if (value === null || value === undefined || value === false || value === true) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value === "string") {
      if (preserveWhitespace || value.trim() !== "") out.push({ kind: "text", value });
      return;
    }
    if (typeof value === "number") return void out.push({ kind: "text", value: num(value) });
    if (typeof value === "object" && "kind" in value) {
      const child = value as SvgNode;
      return child.kind === "fragment" ? child.children.forEach(visit) : void out.push(child);
    }
    throw new Error(`Unsupported SVG child: ${String(value)}`);
  };
  visit(input);
  return out;
};

const NOISY = /-?(?:\d*\.\d{4,}|\d+(?:\.\d*)?e[-+]?\d+)/gi;
const LONG_DECIMAL = /-?\d*\.\d{4,}/g;
const tidy = (text: string, pattern: RegExp, format = num): string => text.replace(pattern, (n) => format(Number(n)));

const style = (value: unknown): string | Css => {
  if (typeof value === "string") return value;
  const parts = Object.entries(value as Record<string, string | number | undefined>)
    .filter(([, entry]) => entry !== undefined)
    .flatMap(([name, entry], index): CssPart[] => [
      index > 0 ? ";" : "",
      ...(isProperty(name) ? [{ property: name }, `:${formatProperty(name, entry!)}`] : [`${kebab(name)}:${typeof entry === "number" ? num(entry) : tidy(entry!, LONG_DECIMAL)}`]),
    ]);
  return parts.every((part) => typeof part === "string") ? parts.join("") : new Css(parts);
};

const attrValue = (prop: string, value: unknown): AttrValue | undefined => {
  if (value === undefined || value === null || value === false) return undefined;
  if (prop === "class") return (Array.isArray(value) ? value : [value]).filter(Boolean).join(" ") || undefined;
  if (prop === "style") return style(value) || undefined;
  if (typeof value === "string") return prop === "d" ? compactPath(value) : prop === "points" ? tidy(value, NOISY) : prop === "transform" ? tidy(value, NOISY, significant) : value;
  if (typeof value === "number") return num(value);
  if (isRef(value) || isFontValue(value)) return value;
  throw new Error(`Unsupported value for ${prop}: ${String(value)}`);
};

const stack = (value: unknown): Motion[] =>
  (Array.isArray(value) ? value : [value]).filter((entry): entry is Motion => {
    if (!entry) return false;
    if (!isMotion(entry)) throw new Error("animation takes motions built with motion() or a recipe.");
    return true;
  });

export const node = (tag: string, props: Record<string, unknown>): Element => {
  const attrs: Record<string, AttrValue> = {};
  for (const [prop, value] of Object.entries(props)) {
    if (prop === "children" || prop === "animation" || prop === "key") continue;
    const resolved = attrValue(prop, value);
    if (resolved !== undefined) attrs[attributeName(tag, prop)] = resolved;
  }
  return element(tag, attrs, children(props.children, TEXT_TAGS.has(tag)), stack(props.animation));
};

const serializeAttrs = (attrs: Readonly<Record<string, AttrValue>>): string =>
  Object.entries(attrs)
    .map(([name, value]) => {
      if (typeof value !== "string") throw new Error(`Unresolved ref in ${name}.`);
      return ` ${name}="${escapeAttr(value)}"`;
    })
    .join("");

const cdata = (text: string): string => `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

const inline = (node: SvgNode, rawText = false): string => {
  switch (node.kind) {
    case "text":
      return rawText ? node.value : escapeText(node.value);
    case "raw":
      return node.value;
    case "fragment":
      return node.children.map((child) => inline(child, rawText)).join("");
    case "element": {
      const open = `<${node.tag}${serializeAttrs(node.attrs)}`;
      if (node.children.length === 0) return `${open}/>`;
      const isRaw = RAW_TEXT_TAGS.has(node.tag);
      const inner = node.children.map((child) => inline(child, rawText || isRaw)).join("");
      return `${open}>${isRaw ? cdata(inner) : inner}</${node.tag}>`;
    }
  }
};

export const serialize = (node: SvgNode): string => inline(node);
