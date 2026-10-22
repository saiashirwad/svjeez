import { escapeAttr, escapeText, kebab, num } from "./format";
import type { AnimationRequest } from "./types";

export type Child =
  | SvgNode
  | string
  | number
  | boolean
  | null
  | undefined
  | readonly Child[];

export type ChildInput = Child | readonly Child[];

export interface ElementProps {
  children?: ChildInput;
  animation?: AnimationRequest;
  /** Joins arrays with spaces; falsy entries are dropped. */
  class?: string | readonly (string | false | null | undefined)[];
  style?: string | Record<string, string | number | undefined>;
  [attribute: string]: unknown;
}

export type SvgNode =
  | {
      kind: "element";
      tag: string;
      attrs: Record<string, string>;
      children: SvgNode[];
      animation?: AnimationRequest;
    }
  | { kind: "text"; value: string }
  | { kind: "raw"; value: string }
  | { kind: "fragment"; children: SvgNode[] };

const TEXT_TAGS = new Set(["text", "tspan", "title", "desc"]);
const RAW_TEXT_TAGS = new Set(["style", "script"]);

/** SVG attributes whose canonical spelling is camelCase. */
const CAMEL_ATTRS = new Set([
  "viewBox",
  "preserveAspectRatio",
  "pathLength",
  "gradientUnits",
  "gradientTransform",
  "patternUnits",
  "patternTransform",
  "patternContentUnits",
  "clipPathUnits",
  "maskUnits",
  "maskContentUnits",
  "filterUnits",
  "primitiveUnits",
  "markerUnits",
  "markerWidth",
  "markerHeight",
  "refX",
  "refY",
  "startOffset",
  "textLength",
  "lengthAdjust",
  "spreadMethod",
  "stdDeviation",
  "baseFrequency",
  "numOctaves",
  "stitchTiles",
  "tableValues",
  "kernelMatrix",
  "kernelUnitLength",
  "preserveAlpha",
  "surfaceScale",
  "specularConstant",
  "specularExponent",
  "diffuseConstant",
  "limitingConeAngle",
  "pointsAtX",
  "pointsAtY",
  "pointsAtZ",
  "xChannelSelector",
  "yChannelSelector",
  "edgeMode",
  "targetX",
  "targetY",
  "keyPoints",
  "keySplines",
  "keyTimes",
  "calcMode",
  "repeatCount",
  "repeatDur",
  "attributeName",
  "attributeType",
  "baseProfile",
  "zoomAndPan",
  "externalResourcesRequired",
  "requiredExtensions",
  "requiredFeatures",
  "systemLanguage",
  "viewTarget",
  "panose1",
  "horizAdvX",
  "horizOriginX",
  "vertAdvY",
  "vertOriginY",
  "unitsPerEm",
  "capHeight",
  "xHeight",
  "accentHeight",
  "underlinePosition",
  "underlineThickness",
  "strikethroughPosition",
  "strikethroughThickness",
  "overlinePosition",
  "overlineThickness",
  "unicodeRange",
]);

const SPECIAL_ATTRS: Record<string, string> = {
  className: "class",
  xlinkHref: "xlink:href",
  xlinkTitle: "xlink:title",
  xmlSpace: "xml:space",
  xmlLang: "xml:lang",
  xmlnsXlink: "xmlns:xlink",
};

const normalizeAttrName = (name: string): string => {
  if (SPECIAL_ATTRS[name]) return SPECIAL_ATTRS[name];
  if (name.includes("-") || name.includes(":")) return name;
  if (CAMEL_ATTRS.has(name)) return name;
  return kebab(name);
};

const styleToString = (style: Record<string, string | number | undefined>): string =>
  Object.entries(style)
    .filter(([, value]) => value !== undefined)
    .map(([property, value]) => `${kebab(property)}:${value}`)
    .join(";");

const normalizeAttrValue = (name: string, value: unknown): string | undefined => {
  if (value === undefined || value === null || value === false) return undefined;
  if (name === "class" || name === "className") {
    const parts = Array.isArray(value) ? value : [value];
    const joined = parts.filter(Boolean).join(" ").trim();
    return joined || undefined;
  }
  if (name === "style") {
    if (typeof value === "string") return value || undefined;
    if (value && typeof value === "object") return styleToString(value as Record<string, string | number | undefined>) || undefined;
    throw new Error(`The style attribute must be a string or object.`);
  }
  if (name === "dangerouslySetInnerHTML") {
    throw new Error("Use raw() for unescaped SVG content instead of dangerouslySetInnerHTML.");
  }
  if (typeof value === "string") return value;
  if (typeof value === "number") return num(value);
  if (value === true) return "true";
  if (Array.isArray(value)) return value.map((entry) => String(entry)).join(" ");
  throw new Error(`Unsupported value for attribute "${name}": ${String(value)}`);
};

export const normalizeAttrs = (props: Record<string, unknown>): Record<string, string> => {
  const attrs: Record<string, string> = {};
  for (const [rawName, rawValue] of Object.entries(props)) {
    if (rawName === "children" || rawName === "animation" || rawName === "key" || rawName === "ref") continue;
    const name = normalizeAttrName(rawName);
    const value = normalizeAttrValue(rawName, rawValue);
    if (value !== undefined && value !== "") attrs[name] = value;
  }
  return attrs;
};

const normalizeChildren = (input: unknown, preserveWhitespace: boolean): SvgNode[] => {
  const out: SvgNode[] = [];
  const visit = (value: unknown): void => {
    if (value === null || value === undefined || value === false || value === true) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value === "string") {
      if (!preserveWhitespace && value.trim() === "") return;
      out.push({ kind: "text", value });
      return;
    }
    if (typeof value === "number") {
      out.push({ kind: "text", value: num(value) });
      return;
    }
    if (typeof value === "object" && "kind" in value) {
      out.push(value as SvgNode);
      return;
    }
    throw new Error(`Unsupported SVG child: ${String(value)}`);
  };
  visit(input);
  return out;
};

export interface NodeProps extends ElementProps {}

/**
 * Create an SVG element. `animation` is metadata for the Scene and is never
 * serialized; `children` can be supplied here or as the third argument.
 */
export const node = (tag: string, props: NodeProps = {}, children?: ChildInput): SvgNode => {
  const { animation, children: propChildren, ...rest } = props;
  const content = children !== undefined ? children : propChildren;
  return {
    kind: "element",
    tag,
    attrs: normalizeAttrs(rest),
    children: normalizeChildren(content, TEXT_TAGS.has(tag)),
    animation,
  };
};

export const raw = (value: string): SvgNode => ({ kind: "raw", value });
export const fragment = (children: ChildInput): SvgNode => ({
  kind: "fragment",
  children: normalizeChildren(children, false),
});
export const comment = (value: string): SvgNode => raw(`<!-- ${value} -->`);

export const withAnimation = (node: SvgNode, animation: AnimationRequest): SvgNode => {
  if (node.kind !== "element") throw new Error("Only SVG elements can carry animations.");
  return { ...node, animation };
};

export const cloneNode = (node: SvgNode): SvgNode => {
  switch (node.kind) {
    case "element":
      return {
        kind: "element",
        tag: node.tag,
        attrs: { ...node.attrs },
        children: node.children.map(cloneNode),
        ...(node.animation ? { animation: node.animation } : {}),
      };
    case "fragment":
      return { kind: "fragment", children: node.children.map(cloneNode) };
    case "text":
    case "raw":
      return { ...node };
  }
};

const serializeAttrs = (attrs: Record<string, string>): string =>
  Object.entries(attrs)
    .map(([name, value]) => ` ${name}="${escapeAttr(value)}"`)
    .join("");

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
      return `${open}>${node.children.map((child) => inline(child, isRaw || rawText)).join("")}</${node.tag}>`;
    }
  }
};

export interface SerializeOptions {
  indent?: string;
}

const serializeNode = (node: SvgNode, depth: number, indent: string): string => {
  const pad = indent.repeat(depth);
  switch (node.kind) {
    case "text":
      return pad + escapeText(node.value);
    case "raw":
      return pad + node.value;
    case "fragment":
      return node.children
        .map((child) => serializeNode(child, depth, indent))
        .filter(Boolean)
        .join("\n");
    case "element": {
      const open = `${pad}<${node.tag}${serializeAttrs(node.attrs)}`;
      if (node.children.length === 0) return `${open}/>`;
      if (TEXT_TAGS.has(node.tag)) {
        return `${open}>${node.children.map((child) => inline(child)).join("")}</${node.tag}>`;
      }
      if (RAW_TEXT_TAGS.has(node.tag)) {
        return `${open}>${node.children.map((child) => inline(child, true)).join("")}</${node.tag}>`;
      }
      const children = node.children.map((child) => serializeNode(child, depth + 1, indent)).join("\n");
      return `${open}>\n${children}\n${pad}</${node.tag}>`;
    }
  }
};

export const serialize = (node: SvgNode, options: SerializeOptions = {}): string =>
  serializeNode(node, 0, options.indent ?? "  ");

/** Element helpers. Hyphenated attributes and camelCase SVG attributes both work. */
const tag =
  (name: string) =>
  (props: NodeProps = {}, children?: ChildInput): SvgNode =>
    node(name, props, children);

export const svg = tag("svg");
export const g = tag("g");
export const defs = tag("defs");
export const rect = tag("rect");
export const circle = tag("circle");
export const ellipse = tag("ellipse");
export const line = tag("line");
export const path = tag("path");
export const polygon = tag("polygon");
export const polyline = tag("polyline");
export const use = tag("use");
export const symbol = tag("symbol");
export const marker = tag("marker");
export const mask = tag("mask");
export const clipPath = tag("clipPath");
export const pattern = tag("pattern");
export const linearGradient = tag("linearGradient");
export const radialGradient = tag("radialGradient");
export const stop = tag("stop");
export const filter = tag("filter");
export const feDropShadow = tag("feDropShadow");
export const feGaussianBlur = tag("feGaussianBlur");
export const feBlend = tag("feBlend");
export const feMerge = tag("feMerge");
export const feMergeNode = tag("feMergeNode");
export const title = (content: ChildInput, props: NodeProps = {}): SvgNode =>
  node("title", props, content);
export const desc = (content: ChildInput, props: NodeProps = {}): SvgNode =>
  node("desc", props, content);
export const image = tag("image");

export const text = (content: ChildInput, props: NodeProps = {}): SvgNode =>
  node("text", props, content);

export const tspan = (content: ChildInput, props: NodeProps = {}): SvgNode =>
  node("tspan", props, content);

export const style = (css: string, props: NodeProps = {}): SvgNode =>
  node("style", props, raw(`\n${css}\n`));
