import { ease, motion, sampled } from "svjeez";
import { r1, type Cx } from "./look";
import { MELT, meltScale } from "./motions";
import { INK } from "./palette";

/** In 4D the body leaves a faint copy of itself wandering through the slice. */
export const ghost = (cx: Cx, bodyD: string) =>
  cx.f.four && (
    <path
      d={bodyD}
      fill="none"
      stroke="#7B5CFF"
      strokeWidth={cx.lay.G}
      strokeLinecap="round"
      opacity={0.18}
      animation={sampled(
        (t) => ({
          x: 14 * Math.cos((Math.PI * 2 * t) / 4),
          y: 10 * Math.sin((Math.PI * 4 * t) / 4),
        }),
        { duration: 4, step: 0.1, precision: 1, tolerance: { translate: 1 } },
      ).loop(4)}
    />
  );

/** Drops that fall off a melting body. */
export const drips = (cx: Cx) => {
  const { lay, pal, ink, rand } = cx;
  const { G, frames } = lay;

  return (
    cx.f.liquid &&
    Array.from({ length: 6 }, (_, i) => {
      const fr = frames[Math.floor(rand() * frames.length)]!;
      const p = lay.melt(fr.p);
      const at = MELT.at + 0.8 + i * 0.55;
      const fall = Math.max(16, lay.floor - p.y + G * 0.2);

      return (
        <circle
          cx={r1(p.x)}
          cy={r1(p.y + G * 0.35)}
          r={r1(Math.max(3, G * 0.12))}
          fill={pal.base}
          stroke={ink}
          strokeWidth={1.5}
          animation={motion({ opacity: 0, y: 0, scale: 0.4 })
            .at(at)
            .to({ opacity: 1, scale: 1 }, 0.25)
            .to({ y: r1(fall) }, 0.45, ease.in)
            .to({ opacity: 0, scale: 1.6 }, 0.15)}
        />
      );
    })
  );
};

export const shadow = (cx: Cx) => {
  const { g, f, lay } = cx;
  const { G, spine } = lay;
  const width = Math.max(...spine.map((p) => p.x)) - Math.min(...spine.map((p) => p.x)) + G;

  const stand = Math.max(
    0,
    ...lay.legs.map((l) =>
      Math.cos((l.angle * Math.PI) / 180) > 0.3
        ? l.length * Math.cos((l.angle * Math.PI) / 180)
        : 0,
    ),
  );

  return (
    g.plan === "line" && (
      <ellipse
        cx={r1(lay.center.x)}
        cy={r1(lay.floor + stand - 2)}
        rx={r1(width * 0.52)}
        ry={r1(G * 0.22 + 3)}
        fill={INK}
        opacity={f.liquid ? 0.16 : 0.08}
        animation={f.liquid ? meltScale(1.35) : undefined}
      />
    )
  );
};
