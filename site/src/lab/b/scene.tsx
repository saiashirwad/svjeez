import { defaults, easing, number, type Values } from "svjeez/params";
import { ease, motion, render, sampled } from "svjeez";
import { COLORS, lightAt, skyAt } from "./feel";
import { spring } from "./physics";

/** The feel the instruments set. */
export const params = {
  bpm: number(104, { min: 50, max: 200, step: 1 }),
  /** Beats between one gummy's hop and the next. Negative runs right to left. */
  stagger: number(0.25, { min: -0.8, max: 0.8 }),
  /** How far a landing squashes. */
  squash: number(0.34, { min: 0.04, max: 0.6 }),
  /** The landing spring's natural frequency in wobbles per second. */
  hz: number(3.2, { min: 0.8, max: 8, step: 0.1 }),
  /** Damping ratio, from jelly to dead. */
  damping: number(0.16, { min: 0.03, max: 0.9 }),
  /** The fall. The rise is the same curve run backwards. */
  fall: easing(ease.bezier(0.5, 0, 0.9, 0.5)),
  /** Hour of the day. */
  hour: number(14, { min: 0, max: 24 }),
};

export type Feel = Values<typeof params>;

const W = 64;
const H = 64;
const GROUND = 300;

/** The five gummies hopping in turn, as the instruments set them. */
export default (feel: Feel = defaults(params)): string => {
  const beat = 60 / feel.bpm;
  const stagger = feel.stagger * beat;
  const duration = 8 * beat;
  const fall = feel.fall;
  const [x1, y1, x2, y2] = fall.kind === "bezier" ? fall.points : [0, 0, 1, 1];
  const rise = ease.bezier(1 - x2, 1 - y2, 1 - x1, 1 - y1);
  const light = lightAt(feel.hour);

  /** Squash at time t: anticipation, stretch in the air, then the landing spring. */
  const squash = (t: number, launch: number, land: number) => {
    if (t < launch - beat / 4) return 0;

    if (t < launch) return 0.6 * feel.squash * Math.sin(((t - launch) / beat + 0.25) * 2 * Math.PI);

    if (t < land)
      return -0.5 * feel.squash * Math.abs(Math.cos((Math.PI * (t - launch)) / (land - launch)));

    return spring(t - land, feel);
  };

  const gummies = COLORS.map((fill, i) => {
    const order = stagger < 0 ? COLORS.length - 1 - i : i;
    const launch = beat * 0.75 + order * Math.abs(stagger);
    const land = launch + 2 * beat;
    const s = (t: number) => squash(t, launch, land);
    const cx = 120 + i * 100;

    const body = sampled(
      (t) => {
        const w = W * (1 + 0.8 * s(t));
        const h = H * (1 - s(t));

        return { x: (W - w) / 2, y: H - h, width: w, height: h };
      },
      { duration, step: 1 / 60, tolerance: { translate: 0.4, width: 0.4, height: 0.4 } },
    );

    const eyes = sampled((t) => ({ y: H * s(t) * 0.75 }), {
      duration,
      step: 1 / 60,
      tolerance: { translate: 0.4 },
    });

    const hop = motion({ y: 0 }).at(launch).to({ y: -150 }, beat, rise).to({ y: 0 }, beat, fall);

    const shadow = motion({ scale: 1, opacity: 0.3 })
      .at(launch)
      .to({ scale: 0.4, opacity: 0.1 }, beat, rise)
      .to({ scale: 1, opacity: 0.3 }, beat, fall);

    return (
      <g>
        <ellipse cx={cx} cy={GROUND + 4} rx={34} ry={6} fill="#000" animation={shadow} />
        <g animation={hop}>
          <rect
            x={cx - W / 2}
            y={GROUND - H}
            width={W}
            height={H}
            rx={24}
            fill={fill}
            animation={body}
          />
          <g animation={eyes}>
            <circle cx={cx - 11} cy={GROUND - 40} r={5} fill="#1B1B2F" />
            <circle cx={cx + 11} cy={GROUND - 40} r={5} fill="#1B1B2F" />
          </g>
        </g>
      </g>
    );
  });

  return render(
    { width: 640, height: 360, duration, title: "Five gummies hop in a rhythm" },
    <>
      <rect width={640} height={360} fill={skyAt(feel.hour)} />
      <circle cx={light.x} cy={light.y} r={light.r} fill={light.fill} />
      <rect y={GROUND} width={640} height={60} fill="#1B1B2F" />
      {gummies}
    </>,
  );
};
