import type { Lane } from "./compile";
import type { Stretch } from "../model/dark";
import { isFontValue, type FontValue } from "../font/font";
import { escapeAttr, escapeText } from "../model/format";

export type AttrValue = string | FontValue;

export type SvgNode =
  | {
      readonly kind: "element";
      readonly tag: string;
      readonly attrs: Readonly<Record<string, AttrValue>>;
      readonly children: readonly SvgNode[];
      readonly lanes?: readonly Lane[];
      readonly still?: Readonly<Record<string, AttrValue>>;
      /** The attributes that draw it. When given, every other one only places it, so a copy can carry those. */
      readonly drawn?: readonly string[];
      /** When the node holds at opacity 0 long enough that the SVG stops drawing it, in scene seconds. */
      readonly cull?: readonly Stretch[];
    }
  | { readonly kind: "text"; readonly value: string }
  | { readonly kind: "raw"; readonly value: string }
  | { readonly kind: "fragment"; readonly children: readonly SvgNode[] };

export type Element = Extract<SvgNode, { kind: "element" }>;

const TEXT_TAGS = new Set(["text", "tspan", "title", "desc", "script"]);
const RAW_TEXT_TAGS = new Set(["style"]);

export const element = (
  tag: string,
  attrs: Readonly<Record<string, AttrValue>> = {},
  children: readonly SvgNode[] = [],
): Element => ({ kind: "element", tag, attrs, children });

export const raw = (value: string): SvgNode => ({ kind: "raw", value });

export const text = (value: string): SvgNode => ({ kind: "text", value });

const serializeAttrs = (attrs: Readonly<Record<string, AttrValue>>): string =>
  Object.entries(attrs)
    .map(([name, value]) => {
      if (isFontValue(value)) throw new Error(`Unresolved font in ${name}.`);

      return ` ${name}="${escapeAttr(value)}"`;
    })
    .join("");

const cdata = (text: string): string => `<![CDATA[${text.replaceAll("]]>", "]]]]><![CDATA[>")}]]>`;

/** A node as markup on one line, which is also how much it weighs. */
export const inline = (node: SvgNode, rawText = false): string => {
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
