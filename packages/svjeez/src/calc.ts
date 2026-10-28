import { significant } from "./format";
import { Css, unitOf, type CssPart, type Property, type Syntax, type SyntaxOf } from "./properties";

type Dim = Exclude<Syntax, "color">;

type Op = "+" | "-" | "*" | "/";

type Fn = "sin" | "cos" | "clamp" | "min" | "max";

type Node =
  | { readonly kind: "literal"; readonly value: number; readonly dim: Dim }
  | { readonly kind: "var"; readonly property: Property }
  | { readonly kind: "op"; readonly op: Op; readonly left: Node; readonly right: Node }
  | { readonly kind: "call"; readonly fn: Fn; readonly args: readonly Node[] };

/** A math expression measuring `D`. It is `Css`, so it drops into a `css` hole as is. */
export class Calc<D extends Dim = Dim> extends Css {
  declare readonly dim: D;

  constructor(readonly node: Node) {
    super(node.kind === "op" ? ["calc(", ...lower(node), ")"] : lower(node));
  }
}

type Operand<D extends Dim = Dim> =
  | Calc<D>
  | Property<string, D>
  | (D extends "number" ? number : never);

type DimOf<O extends Operand> = O extends number
  ? "number"
  : O extends Calc<infer D>
    ? D
    : O extends Property
      ? SyntaxOf<O>
      : never;

type Like<O extends Operand> = NoInfer<Operand<DimOf<O>>>;

const PRECEDENCE: Record<Op, number> = { "+": 1, "-": 1, "*": 2, "/": 2 };

const nodeOf = (operand: Operand): Node => {
  if (typeof operand === "number") return { kind: "literal", value: operand, dim: "number" };

  if (typeof operand === "string") return { kind: "var", property: operand };

  return operand.node;
};

const side = (node: Node, parent: Op, right: boolean): CssPart[] => {
  if (node.kind !== "op") return lower(node);
  const outer = PRECEDENCE[parent];
  const inner = PRECEDENCE[node.op];

  const regroups =
    inner < outer || (right && inner === outer && (parent === "-" || parent === "/"));

  return regroups ? ["(", ...lower(node), ")"] : lower(node);
};

const lower = (node: Node): CssPart[] => {
  switch (node.kind) {
    case "literal":
      return [`${significant(node.value)}${unitOf(node.dim)}`];
    case "var":
      return ["var(", { property: node.property }, ")"];
    case "op":
      return [
        ...side(node.left, node.op, false),
        ` ${node.op} `,
        ...side(node.right, node.op, true),
      ];
    case "call":
      return [
        `${node.fn}(`,
        ...node.args.flatMap((arg, i) => (i === 0 ? lower(arg) : [", ", ...lower(arg)])),
        ")",
      ];
  }
};

const fold = <D extends Dim>(op: Op, operands: readonly Operand[]): Calc<D> =>
  new Calc(operands.map(nodeOf).reduce((left, right) => ({ kind: "op", op, left, right })));

const call = <D extends Dim>(fn: Fn, operands: readonly Operand[]): Calc<D> =>
  new Calc({ kind: "call", fn, args: operands.map(nodeOf) });

const unit =
  <D extends "length" | "angle">(dim: D) =>
  (amount: Operand<"number">): Calc<D> =>
    new Calc(
      typeof amount === "number"
        ? { kind: "literal", value: amount, dim }
        : { kind: "op", op: "*", left: nodeOf(amount), right: { kind: "literal", value: 1, dim } },
    );

/**
 * `calc.mul(calc.length(60), px, calc.cos(yaw))` renders `calc(60px * var(--p1) * cos(var(--p2)))`.
 * Operands are numbers, registered properties, or other expressions, and their units are checked:
 * a product or quotient has at most one dimensioned operand and it comes first, because CSS
 * cannot portably multiply two dimensions or divide by one.
 */
export const calc = {
  /** `length(100)` is `100px`; `length(expr)` is `expr * 1px`. */
  length: unit("length"),
  /** `angle(22)` is `22deg`; `angle(expr)` is `expr * 1deg`. */
  angle: unit("angle"),
  add: <O extends Operand>(first: O, ...rest: [Like<O>, ...Like<O>[]]): Calc<DimOf<O>> =>
    fold("+", [first, ...rest]),
  sub: <O extends Operand>(left: O, right: Like<O>): Calc<DimOf<O>> => fold("-", [left, right]),
  mul: <O extends Operand>(
    first: O,
    ...rest: [Operand<"number">, ...Operand<"number">[]]
  ): Calc<DimOf<O>> => fold("*", [first, ...rest]),
  div: <O extends Operand>(dividend: O, divisor: Operand<"number">): Calc<DimOf<O>> =>
    fold("/", [dividend, divisor]),
  sin: (turn: Operand<"angle">): Calc<"number"> => call("sin", [turn]),
  cos: (turn: Operand<"angle">): Calc<"number"> => call("cos", [turn]),
  clamp: <O extends Operand>(low: O, value: Like<O>, high: Like<O>): Calc<DimOf<O>> =>
    call("clamp", [low, value, high]),
  min: <O extends Operand>(first: O, ...rest: [Like<O>, ...Like<O>[]]): Calc<DimOf<O>> =>
    call("min", [first, ...rest]),
  max: <O extends Operand>(first: O, ...rest: [Like<O>, ...Like<O>[]]): Calc<DimOf<O>> =>
    call("max", [first, ...rest]),
} as const;
