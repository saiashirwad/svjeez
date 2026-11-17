/** @jsxImportSource svjeez */
import type { SvgNode } from "svjeez";
import type { Gait } from "./character";
import { canvas, Flipbook, Pixels, PX } from "./pixel";

const GRID = { width: 18, height: 16, feet: [8, 14] } as const;

/** The box a chicken is drawn in, and the point between its feet. */
export const CHICKEN = {
  width: GRID.width * PX,
  height: GRID.height * PX,
  feet: { x: GRID.feet[0] * PX, y: GRID.feet[1] * PX },
} as const;

/** One frame of a hen facing right: its head down to peck, or one leg forward. */
const hen = (peck: boolean, stride: -1 | 0 | 1): SvgNode => {
  const c = canvas(GRID.width, GRID.height).from(1, 1);
  const head = peck ? 4 : 0;

  c.box(5 - stride, 11, 1, 2, "#e8973a").box(8 + stride, 11, 1, 2, "#e8973a");
  c.box(5 - stride, 13, 2, 1, "#e8973a").box(8 + stride, 13, 2, 1, "#e8973a");
  c.oval(6.5, 8, 5.5, 3.6, "#fbf7ee").box(1, 4, 2, 4, "#fbf7ee").box(3, 9, 6, 2, "#e6dfd0");
  c.box(10, 2 + head, 4, 5, "#fbf7ee")
    .box(11, 1 + head, 2, 1, "#e4572e")
    .dot(12, 3 + head, "#2b2233");
  c.box(14, 4 + head, 2, 1, "#f2a541").dot(13, 6 + head, "#e4572e");

  return <Pixels of={c.rim("#3b2a33")} />;
};

const shadow = canvas(GRID.width, GRID.height).oval(8, 14.5, 5, 1.4, "rgba(40,40,20,0.22)");

/** A hen facing right. The stage mirrors it for left. */
export const Chicken = ({ gait }: { readonly gait: Gait }): SvgNode => (
  <>
    <Pixels of={shadow} />
    <Flipbook
      cells={
        gait === "walk"
          ? [
              [hen(false, 1), 0.15],
              [hen(false, 0), 0.15],
              [hen(false, -1), 0.15],
              [hen(false, 0), 0.15],
            ]
          : [
              [hen(false, 0), 1.7],
              [hen(true, 0), 0.2],
              [hen(false, 0), 0.25],
              [hen(true, 0), 0.2],
              [hen(false, 0), 0.65],
            ]
      }
    />
  </>
);
