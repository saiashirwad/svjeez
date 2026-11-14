import { attributeName } from "./attributes";
import { isRef, type AnyRef } from "./defs";
import { isFontValue, type FontValue } from "./font/font";
import { escapeAttr, escapeText, kebab, num } from "./format";
import { isMotion, type Motion, type Stack } from "./motion";
import { Css, formatProperty, isProperty, type CssPart } from "./properties";

export type Child = SvgNode | string | number | boolean | null | undefined | readonly Child[];

export type AttrValue = string | AnyRef | Css | FontValue;

/** CSS declarations as a JSX `style` object: property name to value. */
export type Style = Readonly<Record<string, string | number | undefined>>;

/** A prop as JSX or `el` passes it. `children` and `animation` are typed in `Props`. */
export type Prop = Child | Stack | AttrValue | Style;

/** The props `node` reads. Every key but `children` and `animation` is an attribute. */
export type Props = Readonly<Record<string, Prop>> & {
  readonly children?: Child;
  readonly animation?: Stack;
};

export type SvgNode =
  | {
      readonly kind: "element";
      readonly tag: string;
      readonly attrs: Readonly<Record<string, AttrValue>>;
      readonly children: readonly SvgNode[];
      /** The `animation` stack, outermost first. Never serialized. */
      readonly motions: readonly Motion[];
      /** Set by `<Once>`: every motion from here down plays the timeline one time. Never serialized. */
      readonly once?: boolean;
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

const isNode = (value: Child): value is SvgNode =>
  value !== null && typeof value === "object" && "kind" in value;

/** Text is a string, or a number that `num` writes out. */
const isText = (value: Prop): value is string | number =>
  typeof value === "string" || typeof value === "number";

const isNumber = (value: Prop): value is number => typeof value === "number";

export const children = (input: Child, preserveWhitespace = false): SvgNode[] => {
  const out: SvgNode[] = [];

  const visit = (value: Child): void => {
    if (value === null || value === undefined || value === false || value === true) return;

    if (Array.isArray(value)) return value.forEach(visit);

    if (isNode(value))
      return value.kind === "fragment" ? value.children.forEach(visit) : void out.push(value);

    if (!isText(value)) throw new Error(`Unsupported SVG child: ${String(value)}`);

    const text = isNumber(value) ? num(value) : value;

    if (preserveWhitespace || text.trim() !== "") out.push({ kind: "text", value: text });
  };

  visit(input);

  return out;
};

const isStyleText = (value: string | Style): value is string => typeof value === "string";

const style = (value: string | Style): string | Css => {
  if (isStyleText(value)) return value;

  const entries = Object.entries(value).filter(([, entry]) => entry !== undefined);

  const parts = entries.flatMap(([name, entry], index): CssPart[] => [
    index > 0 ? ";" : "",
    ...(isProperty(name)
      ? [{ property: name }, `:${formatProperty(name, entry!)}`]
      : [`${kebab(name)}:${entry}`]),
  ]);

  return entries.some(([name]) => isProperty(name)) ? new Css(parts) : parts.join("");
};

const attrValue = (prop: string, value: Prop): AttrValue | undefined => {
  if (value === undefined || value === null || value === false) return undefined;

  if (prop === "class")
    return (Array.isArray(value) ? value : [value]).filter(Boolean).join(" ") || undefined;

  if (prop === "style") {
    // SAFETY: the JSX types give a style prop as text or a Style object, the two forms style() takes.
    return style(value as string | Style) || undefined;
  }

  if (isText(value)) return isNumber(value) ? num(value) : value;

  if (isRef(value) || isFontValue(value)) return value;

  throw new Error(`Unsupported value for ${prop}: ${String(value)}`);
};

const stack = (value: Stack | undefined): Motion[] =>
  (Array.isArray(value) ? value : [value]).filter((entry): entry is Motion => {
    if (!entry) return false;

    if (!isMotion(entry))
      throw new Error("animation takes motions built with motion() or a recipe.");

    return true;
  });

export const node = (tag: string, props: Props): Element => {
  const attrs: Record<string, AttrValue> = {};

  for (const [prop, value] of Object.entries(props)) {
    if (prop === "children" || prop === "animation" || prop === "key") continue;
    const resolved = attrValue(prop, value);

    if (resolved !== undefined) attrs[attributeName(tag, prop)] = resolved;
  }

  return element(tag, attrs, children(props.children, TEXT_TAGS.has(tag)), stack(props.animation));
};

const isResolved = (value: AttrValue): value is string => typeof value === "string";

const serializeAttrs = (attrs: Readonly<Record<string, AttrValue>>): string =>
  Object.entries(attrs)
    .map(([name, value]) => {
      if (!isResolved(value)) throw new Error(`Unresolved ref in ${name}.`);

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

const serializeNode = (node: SvgNode, depth: number): string => {
  const pad = "  ".repeat(depth);

  switch (node.kind) {
    case "text":
      return pad + escapeText(node.value);
    case "raw":
      return pad + node.value;
    case "fragment":
      return node.children
        .map((child) => serializeNode(child, depth))
        .filter(Boolean)
        .join("\n");
    case "element": {
      if (node.children.length === 0 || TEXT_TAGS.has(node.tag) || RAW_TEXT_TAGS.has(node.tag))
        return pad + inline(node);
      const inner = node.children.map((child) => serializeNode(child, depth + 1)).join("\n");

      return `${pad}<${node.tag}${serializeAttrs(node.attrs)}>\n${inner}\n${pad}</${node.tag}>`;
    }
  }
};

export const serialize = (node: SvgNode): string => serializeNode(node, 0);
