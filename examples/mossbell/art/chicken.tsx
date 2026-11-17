/** @jsxImportSource svjeez */
import { ease, motion, Pivot, span, type SvgNode } from "svjeez";
import type { Gait } from "./character";

/** The box a chicken is drawn in, and the point between its feet. */
export const CHICKEN = { width: 40, height: 40, feet: { x: 20, y: 34 } } as const;

const STEP = 0.4;

const leg = (gait: Gait, phase: 0 | 1) =>
  gait === "walk"
    ? motion({ rotate: phase === 0 ? 22 : -22 })
        .to({ rotate: phase === 0 ? -22 : 22 }, span(0, STEP / 2), ease.inOut)
        .to({ rotate: phase === 0 ? 22 : -22 }, span(STEP / 2, STEP / 2), ease.inOut)
        .loop(STEP)
    : undefined;

const peck = motion({ rotate: 0 })
  .to({ rotate: 38 }, span(1.6, 0.18), ease.in)
  .to({ rotate: 0 }, span(1.78, 0.2))
  .to({ rotate: 38 }, span(2.1, 0.18), ease.in)
  .to({ rotate: 0 }, span(2.28, 0.25))
  .loop(3);

/** A hen facing right. The stage mirrors it for left. */
export const Chicken = ({ gait }: { readonly gait: Gait }): SvgNode => (
  <>
    <ellipse cx={20} cy={34} rx={11} ry={3.5} fill="rgba(40,40,20,0.2)" />
    <Pivot origin={{ x: 17, y: 27 }} animation={leg(gait, 0)}>
      <path
        d="M17 27V34M14.5 34H20"
        stroke="#e8973a"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Pivot>
    <Pivot origin={{ x: 23, y: 27 }} animation={leg(gait, 1)}>
      <path
        d="M23 27V34M20.5 34H26"
        stroke="#e8973a"
        strokeWidth={1.8}
        strokeLinecap="round"
        fill="none"
      />
    </Pivot>
    <g
      animation={
        gait === "walk"
          ? motion({ y: 0 })
              .to({ y: -1.5 }, span(0, STEP / 4))
              .to({ y: 0 }, span(STEP / 4, STEP / 4), ease.in)
              .loop(STEP / 2)
          : undefined
      }
    >
      <path d="M8 16C5 12 6 8 9 9C10 13 11 15 13 17Z" fill="#f4efe6" />
      <ellipse cx={19} cy={21} rx={11.5} ry={9} fill="#fbf7ee" />
      <path d="M12 20C15 26 22 26 25 21C21 23 16 22 12 20Z" fill="#e6dfd0" />
      <Pivot origin={{ x: 26, y: 18 }} animation={gait === "idle" ? peck : undefined}>
        <circle cx={28} cy={12} r={6.5} fill="#fbf7ee" />
        <path d="M24 7C24 3 27 3 27.5 6C28 3 31 3 31 6.500C32.5 5 34 7 32 9L25 8Z" fill="#e4572e" />
        <path d="M33.5 11L38 13L33.5 15Z" fill="#f2a541" />
        <circle cx={30} cy={11.5} r={1.2} fill="#2b2233" />
        <ellipse cx={31.5} cy={17} rx={1.6} ry={2.4} fill="#e4572e" />
      </Pivot>
    </g>
  </>
);
