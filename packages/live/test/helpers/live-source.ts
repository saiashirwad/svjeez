import { readFileSync } from "node:fs";
import { parse, type Literal, type LiteralOf } from "../../src/source";

export const meadow = readFileSync(
  new URL("../../../../site/src/lab/a/meadow.tsx", import.meta.url),
  "utf8",
);

export const plane = `const launch = 0.4;
const legs = [
  { to: [150, -80], over: 1.5 },
  { to: [300, 175], over: 1.2 },
];
export default () => <circle cx={legs[0].to[0]} r={4} fill="#FFFFFF" />;
`;

export const keysScene = `export const params = { swing: count(3, { min: 1, max: 9 }) };
const legs = [{ over: 1.5 }, { over: 1.2 }];
export default function build() {
  return <rect fill="#3EE6D6" stroke="#181f2e8c" x={30_000} width={4} opacity={0.5} />;
}
`;

export const numberOf = (literal: Literal | undefined): LiteralOf<"number"> => {
  if (literal?.kind !== "number") throw new Error(`expected a number, got ${literal?.kind}`);

  return literal;
};

export const numbers = (text: string) =>
  parse(text).literals.filter((l): l is LiteralOf<"number"> => l.kind === "number");
