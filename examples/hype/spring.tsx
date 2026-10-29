import { tex } from "@svjeez/math";
import { def, ease, motion, sampled, type Span } from "svjeez";
import { Brace } from "svjeez/extras";
import { theme } from "../style";
import { C, Caption, H } from "./kit";

const FORMULA = String.raw`x(t) = A\,\cssId{decay}{e^{-\gamma t}}\,\cssId{wobble}{\cos(\omega t)}`;
const formula = tex(FORMULA, { x: 640, y: 76, fontSize: 46, theme, anchor: [0.5, 0] });

const AMP = 110;
const REST = 400;
const BOB = 300;
const PLOT = { x: 450, w: 700 };

/** The spring and its plot share one function of time, so the weight and the playhead never drift apart. */
export const springShot = ({ at, over }: Span) => {
  const written = { at: at + 0.25, over: 0.9 };
  const run = { at: written.at + written.over + 0.2, over: over - 1.9 };
  const clamp = (t: number) => Math.min(Math.max(t - run.at, 0), run.over);

  const spring = (t: number) =>
    AMP * Math.exp(-2.4 * clamp(t)) * Math.cos(2 * Math.PI * 1.9 * clamp(t));

  const plotX = (t: number) => PLOT.x + (clamp(t) / run.over) * PLOT.w;
  const tolerance = { translate: 0.4 };

  const curve = Array.from({ length: 161 }, (_, i) => run.at + (i / 160) * run.over)
    .map((t, i) => `${i ? "L" : "M"}${plotX(t).toFixed(1)} ${(REST + spring(t)).toFixed(1)}`)
    .join("");

  const weight = sampled((t) => ({ y: spring(t) }), {
    duration: run.at + run.over + 0.05,
    step: 1 / 60,
    tolerance,
  });

  const playhead = sampled((t) => ({ x: plotX(t), y: REST + spring(t) }), {
    duration: run.at + run.over + 0.05,
    step: 1 / 60,
    tolerance,
  });

  // The plot reveals left to right with time, so its tip stays under the playhead.
  const traced = def.clipPath(
    {},
    <rect
      x={PLOT.x - 4}
      y={0}
      width={4}
      height={H}
      animation={motion({ width: 4 })
        .at(run.at)
        .to({ width: PLOT.w + 8 }, run.over, ease.linear)}
    />,
  );

  const hung = def.clipPath({}, <rect x={BOB - 60} y={230} width={120} height={360} />);
  const notes = { at: written.at + written.over, over: over - written.over - 0.6 };

  return (
    <>
      {formula.write(written)}
      <Brace
        target={formula.get("decay")}
        side="below"
        label="damping"
        fontSize={15}
        theme={theme}
        color={C.accent}
        during={notes}
      />
      <Brace
        target={formula.get("wobble")}
        side="below"
        label="oscillation"
        fontSize={15}
        theme={theme}
        color={C.accent}
        during={notes}
      />
      <path d={`M${BOB - 40} 230H${BOB + 40}`} stroke={C.muted} strokeWidth={2} />
      <g clipPath={hung}>
        <g animation={weight}>
          <path d={`M${BOB} ${REST - 400}V${REST}`} stroke={C.muted} strokeWidth={2} />
          <rect x={BOB - 24} y={REST - 24} width={48} height={48} rx={8} fill={C.ink} />
        </g>
      </g>
      <path d={`M${PLOT.x} ${REST}H${PLOT.x + PLOT.w}`} stroke={C.hairline} strokeDasharray="3 5" />
      <g clipPath={traced}>
        <path d={curve} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle r={6} fill={C.accent} animation={playhead} />
      <Caption
        at={at + 0.1}
        tag="@svjeez/math · sampled()"
        call="tex(`x(t) = …`) + sampled(t => x(t))"
        line="typeset the equation, then run it"
      />
    </>
  );
};
