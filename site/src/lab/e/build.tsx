import { css, fx, render } from "svjeez";
import { body, spots } from "./body";
import { bodyEyes, headless, heads, legs, tails } from "./parts";
import { drips, ghost, shadow } from "./extras";
import type { Genome } from "./genome";
import { DURATION, H, STILL_AT, W } from "./geometry";
import { newCx, r1 } from "./look";
import { breathing } from "./motions";
import { PAPER } from "./palette";
import { magicHat, quirkWord, stage, unitBar } from "./stage";

/** The animated SVG for a genome. Parts draw in a fixed order, because each takes its random numbers in turn. */
export const build = (g: Genome): string => {
  const cx = newCx(g);
  const { lay } = cx;
  const { G } = lay;

  const { breath, motion: breathMotion } = breathing(cx);

  const style = css`
    .co { stroke-width: calc(${G + 5}px * ${breath} + 0px); }
    .cf { stroke-width: calc(${G}px * ${breath}); }
    .ct { stroke-width: calc(${r1(G * 0.84)}px * ${breath}); }
  `;

  const torso = body(cx);
  const spotted = spots(cx);
  const legsDrawn = legs(cx);
  const tailsDrawn = tails(cx);
  const eyesDrawn = bodyEyes(cx);
  const headsDrawn = heads(cx);
  const headlessDrawn = headless(cx);
  const ghostDrawn = ghost(cx, torso.d);
  const dripsDrawn = drips(cx);
  const shadowDrawn = shadow(cx);

  const boil =
    g.ink > 0.05
      ? fx.boil({ strength: r1(g.ink * 1.4), rate: 8, seed: g.seed % 50, detail: 0.035 })
      : undefined;

  const creature = () => (
    <g transform={`translate(${r1(lay.ox)} ${r1(lay.oy)}) scale(${lay.scale.toFixed(4)})`}>
      {shadowDrawn}
      <g style={{ [breath]: 1 }} animation={breathMotion}>
        {ghostDrawn}
        {tailsDrawn}
        {legsDrawn}
        {torso.whole()}
        {spotted}
        {torso.crossings()}
        {eyesDrawn}
        {headsDrawn}
        {headlessDrawn}
        {dripsDrawn}
      </g>
    </g>
  );

  return render(
    {
      width: W,
      height: H,
      duration: DURATION,
      title: "Catoid",
      desc: `A catoid with ${g.heads} heads, ${g.legs} legs and ${g.tails} tails, ${r1(g.length)} cats long.`,
      css: style,
      reducedMotion: { at: STILL_AT },
    },
    <>
      <rect width={W} height={H} fill={PAPER} />
      <path
        d={
          Array.from({ length: 16 }, (_, i) => `M${i * 40 + 20} 0V${H}`).join("") +
          Array.from({ length: 10 }, (_, i) => `M0 ${i * 40 + 20}H${W}`).join("")
        }
        stroke="#D9D0BC"
        strokeWidth={0.6}
        opacity={0.55}
      />
      <g filter={boil}>
        {stage(cx, creature)}
        {magicHat(cx)}
        {quirkWord(cx)}
      </g>
      {unitBar(cx)}
    </>,
  );
};
