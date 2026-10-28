import type { Color } from "./attributes";
import { num } from "./format";

const SYNTAX = {
  number: { value: 0 as number, css: "<number>", unit: "" },
  length: { value: 0 as number, css: "<length>", unit: "px" },
  angle: { value: 0 as number, css: "<angle>", unit: "deg" },
  color: { value: "" as Color, css: "<color>", unit: "" },
} as const;

export type Syntax = keyof typeof SYNTAX;
export type SyntaxValue<S extends Syntax> = (typeof SYNTAX)[S]["value"];

export const unitOf = (syntax: Syntax): string => SYNTAX[syntax].unit;

/**
 * A registered custom property is its own key: `{ [yaw]: 90 }` in a motion or a style. The name and syntax
 * live in the literal type, so each value is checked against its syntax. Render gives it a short name per file.
 */
export type Property<N extends string = string, S extends Syntax = Syntax> = `--${N}:${S}`;
export type SyntaxOf<P extends Property> = P extends `--${string}:${infer S extends Syntax}` ? S : never;
export type NumericProperty = Property<string, Exclude<Syntax, "color">>;
export type PropertyValues = { readonly [S in Syntax as Property<string, S>]?: SyntaxValue<S> };

export interface Declaration<S extends Syntax = Syntax> {
  readonly syntax: S;
  readonly inherits: boolean;
  readonly initial: SyntaxValue<S>;
}

const declared = new Map<Property, Declaration>();

export const isProperty = (key: string): key is Property => key.startsWith("--") && key.includes(":");

export const declarationOf = (key: Property): Declaration => {
  const found = declared.get(key);
  if (!found) throw new Error(`${key} was never declared with def.property().`);
  return found;
};

const same = (a: Declaration, b: Declaration): boolean => a.inherits === b.inherits && a.initial === b.initial;

/** Declaring the same property twice returns the same key; declaring it differently throws. */
export const property = <const N extends string, const S extends Syntax>(name: N, declaration: Declaration<S>): Property<N, S> => {
  if (!/^[A-Za-z][\w-]*$/.test(name)) throw new Error(`Property name "${name}" must be a CSS identifier without the leading --.`);
  if (!(declaration.syntax in SYNTAX)) throw new Error(`Unknown property syntax "${declaration.syntax}".`);
  const key: Property<N, S> = `--${name}:${declaration.syntax}`;
  const known = declared.get(key);
  if (known && !same(known, declaration)) throw new Error(`${key} is already declared with inherits ${known.inherits} and initial ${known.initial}.`);
  declared.set(key, declaration);
  return key;
};

export const formatProperty = (key: Property, value: number | string): string => {
  const { unit } = SYNTAX[declarationOf(key).syntax];
  return typeof value === "number" ? `${num(value)}${unit}` : value;
};

export const propertyRule = (name: string, key: Property): string => {
  const { syntax, inherits, initial } = declarationOf(key);
  return `@property ${name}{syntax:'${SYNTAX[syntax].css}';inherits:${inherits};initial-value:${formatProperty(key, initial)}}`;
};

export type CssPart = string | { readonly property: Property };

/** CSS text that names properties before render has named them. */
export class Css {
  constructor(readonly parts: readonly CssPart[]) {}
}

export const isCss = (value: unknown): value is Css => value instanceof Css;

/** `` css`.dot{translate:calc(${px} * 1px) 0}` ``: a property hole becomes `var(--pN)`. */
export const css = (strings: TemplateStringsArray, ...holes: readonly (Property | Css | number)[]): Css =>
  new Css(
    strings.flatMap((text, index) => {
      if (index === holes.length) return [text];
      const hole = holes[index]!;
      if (typeof hole === "number") return [text, num(hole)];
      if (isCss(hole)) return [text, ...hole.parts];
      return [text, "var(", { property: hole }, ")"];
    }),
  );
