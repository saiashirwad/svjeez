/** @jsxImportSource svjeez */
import { ease, motion, random, span, type SvgNode } from "svjeez";
import type { Hex } from "./color";

/** Effects are drawn around 0,0 and play once. Each says how long it runs. */

export const BURST = 0.7;

/** Bits flung outward that shrink and fade: dust, water or sparks, by color and shape. */
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

  return (
    <>
      {Array.from({ length: 7 }, (_, i) => {
        const turn = (i / 7) * Math.PI * 2 + next();
        const reach = 16 + next() * 14;
        const x = Math.cos(turn) * reach;
        const y = Math.sin(turn) * reach * 0.7 - 10;

        const fly = motion({ x: 0, y: 0, opacity: 1, scale: 1 })
          .to({ x, y }, span(0, BURST), ease.out)
          .to({ opacity: 0, scale: 0.3 }, span(BURST * 0.45, BURST * 0.55), ease.in);

        return star ? (
          <path
            d="M0 -5Q0.8 -0.8 5 0Q0.8 0.8 0 5Q-0.8 0.8 -5 0Q-0.8 -0.8 0 -5Z"
            fill={color}
            animation={fly}
          />
        ) : (
          <circle r={2.5 + next() * 2} fill={color} animation={fly} />
        );
      })}
    </>
  );
};

export const FLOAT = 1.1;

/** A word that rises and fades: what was gained. */
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
    fontSize={13}
    fontWeight="bold"
    fontFamily="ui-rounded, system-ui, sans-serif"
    fill={color}
    stroke="#fff8e8"
    strokeWidth={3}
    style="paint-order:stroke"
    animation={motion({ y: 0, opacity: 0, scale: 0.6 })
      .to({ opacity: 1, scale: 1 }, span(0, 0.18), ease.pop)
      .to({ y: -30 }, span(0, FLOAT), ease.out)
      .to({ opacity: 0 }, span(FLOAT - 0.35, 0.35), ease.in)}
  >
    {text}
  </text>
);

export const HEART = 1.2;

export const Heart = (): SvgNode => (
  <path
    d="M0 6C-10 -1 -9 -9 -4 -9C-1.5 -9 0 -7 0 -5C0 -7 1.5 -9 4 -9C9 -9 10 -1 0 6Z"
    fill="#e4572e"
    stroke="#fff8e8"
    strokeWidth={1.5}
    animation={motion({ y: 0, opacity: 0, scale: 0.3 })
      .to({ opacity: 1, scale: 1.2 }, span(0, 0.25), ease.pop)
      .to({ y: -22 }, span(0, HEART), ease.out)
      .to({ opacity: 0 }, span(HEART - 0.4, 0.4), ease.in)}
  />
);
