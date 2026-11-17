import { tex } from "@svjeez/math";
import { def, ease, motion, sampled, span, Brace } from "svjeez";

import { theme } from "../style";
import { C, Caption, Blip, H } from "./kit";

const FORMULA = String.raw`x(t) = A\,\cssId{decay}{e^{-\gamma t}}\,\cssId{wobble}{\cos(\omega t)}`;
const formula = tex(FORMULA, { x: 640, y: 76, fontSize: 46, theme, anchor: [0.5, 0] });

const AMP = 110;
const REST = 400;
const BOB = 300;
const PLOT = { x: 450, w: 700 };

/** The spring and its plot share one function of time, so the weight and the playhead never drift apart. */
/** The spring shot, written from 0 and lasting `over` seconds. */
export const springShot = (over: number) => {
  const written = span(0.25, 0.9);
  const run = written.next(over - 1.9, 0.2);
  const clamp = (t: number) => Math.min(Math.max(t - run.at, 0), run.over);

  const spring = (t: number) =>
    AMP * Math.exp(-2.4 * clamp(t)) * Math.cos(2 * Math.PI * 1.9 * clamp(t));

  const plotX = (t: number) => PLOT.x + (clamp(t) / run.over) * PLOT.w;
  const tolerance = { translate: 0.4 };

  const curve = Array.from({ length: 161 }, (_, i) => run.at + (i / 160) * run.over)
    .map((t, i) => `${i ? "L" : "M"}${plotX(t).toFixed(1)} ${(REST + spring(t)).toFixed(1)}`)
    .join("");

  /** From the start of the shot until the weight has settled. */
  const swing = span(0).until(run.end + 0.05);

  const weight = sampled(swing, (t) => ({ y: spring(t) }), {
    step: 1 / 60,
    tolerance,
  });

  const playhead = sampled(swing, (t) => ({ x: plotX(t), y: REST + spring(t) }), {
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
      animation={motion({ width: 4 }).to({ width: PLOT.w + 8 }, run, ease.linear)}
    />,
  );

  const hung = def.clipPath({}, <rect x={BOB - 60} y={230} width={120} height={400} />);
  const notes = written.next(over - written.over - 0.6);

  return (
    <>
      {formula.write(written).node}
      <Brace
        target={formula.part("decay").box}
        side="below"
        label="damping"
        fontSize={15}
        theme={theme}
        color={C.accent}
        show={notes}
      />
      <Brace
        target={formula.part("wobble").box}
        side="below"
        label="oscillation"
        fontSize={15}
        theme={theme}
        color={C.accent}
        show={notes}
      />
      <path d={`M${BOB - 40} 230H${BOB + 40}`} stroke={C.muted} strokeWidth={2} />
      <g clipPath={hung}>
        <g animation={weight}>
          <path d={`M${BOB} ${REST - 400}V${REST - 30}`} stroke={C.muted} strokeWidth={2} />
          {/* The weight is Blip, bungee-jumping by its antenna. */}
          <Blip
            x={BOB}
            y={REST - 32 + 139 * 0.45}
            size={0.45}
            blinks={[run.at + 1.6]}
            look={motion({ x: 0, y: 0 }).at(run.at).to({ x: 0, y: 6 }, 0.3)}
          />
        </g>
      </g>
      <path d={`M${PLOT.x} ${REST}H${PLOT.x + PLOT.w}`} stroke={C.hairline} strokeDasharray="3 5" />
      <g clipPath={traced}>
        <path d={curve} fill="none" stroke={C.accent} strokeWidth={2.5} strokeLinecap="round" />
      </g>
      <circle r={6} fill={C.accent} animation={playhead} />
      <Caption
        at={0.1}
        tag="@svjeez/math · sampled()"
        call="tex(`x(t) = …`) + sampled(t => x(t))"
        line="typeset the equation, then run it"
      />
    </>
  );
};
