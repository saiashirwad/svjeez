/** @jsxImportSource svjeez */
import { ease, motion, random, span, type SvgNode } from "svjeez";
import type { Hex } from "./color";
import { canvas, Pixels, PX } from "./pixel";

/** Effects are drawn around 0,0 and play once. Each says how long it runs. */

export const BURST = 0.6;

/** Bits flung outward in steps: dust, water or sparks, by color and shape. */
export const Burst = ({
  color,
  seed,
  star,
}: {
  readonly color: Hex;
  readonly seed: string;
  readonly star?: boolean;
}): SvgNode => {
  const next = random(seed);

  const bit = star
    ? canvas(3, 3).box(1, 0, 1, 3, color).box(0, 1, 3, 1, color).dot(1, 1, "#ffffff")
    : canvas(2, 2).box(0, 0, 2, 2, color);

  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const turn = (i / 7) * Math.PI * 2 + next();
        const reach = 18 + next() * 15;
        const x = Math.round((Math.cos(turn) * reach) / PX) * PX;
        const y = Math.round((Math.sin(turn) * reach * 0.7 - 12) / PX) * PX;

        return (
          <g
            animation={motion({ x: 0, y: 0, opacity: 1 })
              .to({ x, y }, span(0, BURST), ease.steps(6))
              .set({ opacity: 0 }, BURST)}
          >
            <Pixels of={bit} anchor={[1, 1]} />
          </g>
        );
      })}
    </>
  );
};

export const FLOAT = 1.1;

/** A word that rises and goes: what was gained. */
export const Floater = ({
  text,
  color,
}: {
  readonly text: string;
  readonly color: Hex;
}): SvgNode => (
  <text
    x={0}
    y={0}
    textAnchor="middle"
    fontSize={18}
    fontWeight="bold"
    fontFamily="'Pixelify Sans', sans-serif"
    fill={color}
    stroke="#fff8e8"
    strokeWidth={3}
    style="paint-order:stroke"
    animation={motion({ y: 0, opacity: 1 })
      .to({ y: -30 }, span(0, FLOAT), ease.steps(10))
      .set({ opacity: 0 }, FLOAT)}
  >
    {text}
  </text>
);

export const HEART = 1.2;

const heart = canvas(9, 8)
  .from(1, 1)
  .box(0, 1, 3, 3, "#e4572e")
  .box(4, 1, 3, 3, "#e4572e")
  .box(1, 0, 1, 1, "#e4572e")
  .box(5, 0, 1, 1, "#e4572e")
  .box(3, 2, 1, 3, "#e4572e")
  .box(1, 4, 5, 1, "#e4572e")
  .box(2, 5, 3, 1, "#e4572e")
  .dot(1, 1, "#ff9f8a")
  .rim("#fff8e8");

export const Heart = (): SvgNode => (
  <g
    animation={motion({ y: 0, opacity: 1 })
      .to({ y: -24 }, span(0, HEART), ease.steps(8))
      .set({ opacity: 0 }, HEART)}
  >
    <Pixels of={heart} anchor={[4, 4]} />
  </g>
);
