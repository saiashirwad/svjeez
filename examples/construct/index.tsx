import { construct, tex } from "@svjeez/math";
import { motion, render } from "svjeez";
import { tint } from "svjeez/extras";
import { css, theme } from "../style";

const W = 960;
const H = 540;
const SIDE = 200;

// Euclid I.1, then the bisector of the angle at C: the construction below is the whole figure.
const g = construct({ theme, at: { x: 235, y: 300 }, fontSize: 24 });

const A = g.point(0, 0, "A", { at: 0.4 });
const B = g.point(SIDE, 0, "B", { at: 0.4 });

const AB = g.segment(A, B, { at: 0.9 });

// Both compass circles pass through the other end of AB. They meet where every side of the triangle is the same length.
const tCircles = g.time;
const circleA = g.circle(A, B, { aid: true });
const circleB = g.circle(B, A, { aid: true });
const C = g.intersect(circleA, circleB, { pick: 0, label: "C" });

g.settle();

const tSides = g.time;

const AC = g.segment(A, C);
const BC = g.segment(B, C);

g.polygon([A, B, C], { opacity: 0.16 });

g.together(() => {
  for (const side of [AB, AC, BC]) g.tick(side);
});

const tAngles = g.time;

g.together(() => {
  g.angle(B, A, C, { label: "60^\\circ" });
  g.angle(C, B, A, { label: "60^\\circ" });
  g.angle(A, C, B);
});

g.step();

const bisector = g.angleBisector(A, C, B, { extend: 24 });
const M = g.intersect(bisector, AB, { label: "M" });

g.settle();

g.angle(A, M, C);

const tDone = g.time;

const note = (source: string, y: number) =>
  tex(source, { x: 690, y, fontSize: 25, theme, anchor: [0, 0.5], display: false });

const duration = Math.ceil(g.end + 3);

export default function build(): string {
  return render(
    {
      width: W,
      height: H,
      duration,
      title: "Euclid I.1 and an angle bisector",
      desc: "Two compass circles about A and B, each through the other, meet at C. Joining C to A and B gives an equilateral triangle with three 60 degree angles. The bisector of the angle at C meets AB at M at a right angle.",
      css,
      reducedMotion: { at: duration - 1 },
    },
    <>
      <rect width="100%" height="100%" fill={theme.base00} />
      <g
        fill={tint(theme, "muted")}
        animation={motion({ opacity: 0 }).at(0.2).to({ opacity: 1 }, 0.6)}
      >
        {
          tex(String.raw`\text{Euclid I.1}`, {
            x: 690,
            y: 100,
            fontSize: 28,
            theme,
            color: tint(theme, "blue"),
            display: false,
          }).node
        }
      </g>
      {g.node}
      {note(String.raw`AC = AB \quad (\text{circle } A)`, 190).write({
        at: tCircles + 1.4,
        over: 1,
      })}
      {note(String.raw`BC = AB \quad (\text{circle } B)`, 240).write({
        at: tCircles + 2.6,
        over: 1,
      })}
      {note(String.raw`AB = AC = BC`, 302).write({ at: tSides + 2.4, over: 1 })}
      {note(String.raw`\angle A = \angle B = \angle C = 60^\circ`, 352).write({
        at: tAngles + 0.6,
        over: 1.2,
      })}
      {note(String.raw`CM \perp AB, \; AM = MB`, 440).write({ at: tDone, over: 1 })}
    </>,
  );
}
