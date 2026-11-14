import { Pivot, css as cssTag, ease, motion, render, sampled, variables, wiggle } from "svjeez";
import { mono } from "../style";
import { CHICK, GROUND, SQUASH, chick, jumps } from "./lib/chick";

// One file, two moods. By day the chick bounces beside a flower that has opened to the sun, and a butterfly loops
// around it. By night, in the very same file, the chick is fast asleep with its antenna bulb as a night-light, the
// flower has closed, and fireflies drift where the butterfly was. The viewer's colour scheme picks which one shows.

const W = 1280;
const H = 720;
const D = 6;
const S = 1.25;
const SPOT = { x: 640, y: 590 };
const FLOWER = { x: 880, base: 590, head: 380 };

const { vars, css: paint } = variables(
  { sky: "#151a2b", hill: "#24392f", far: "#1c2c25", stem: "#3f7a55", glow: "#FFE58A" },
  { sky: "#d6ecf5", hill: "#8fcf9a", far: "#b4e0bb", stem: "#4f9e66", glow: "#FFE58A" },
);

/** Day shows in light mode, night in dark. */
const MOODS = `.night{display:none}@media (prefers-color-scheme:dark){.day{display:none}.night{display:inline}}`;

/** A point on the chick, in page coordinates. */
const at = (x: number, y: number) => ({
  x: SPOT.x + (x - GROUND.x) * S,
  y: SPOT.y + (y - GROUND.y) * S,
});

const placed = `translate(${SPOT.x} ${SPOT.y}) scale(${S}) translate(${-GROUND.x} ${-GROUND.y})`;

export default function build(): string {
  // Day: the chick bounces, and the flower sways in the breeze.
  const hops = jumps([
    { land: 1.0, height: 50 },
    { land: 2.2, height: 30 },
    { land: 4.0, height: 60 },
  ]);

  const sway = wiggle({ rotate: 5 }, { seed: "flower", rate: 0.8 });

  // A butterfly flies a figure eight around the flower, flapping as it goes.
  const butterfly = sampled(
    (t) => {
      const a = (2 * Math.PI * t) / D;

      return { x: FLOWER.x + 150 * Math.sin(a), y: FLOWER.head - 40 + 70 * Math.sin(2 * a) };
    },
    { over: D, tolerance: { translate: 1 } },
  );

  const flap = motion({ scale: 1 })
    .to({ scale: 0.3 }, 0.12, ease.inOut)
    .to({ scale: 1 }, 0.12, ease.inOut)
    .loop(0.24);

  // Night: the chick breathes slowly in its sleep, and Zs drift up from it.
  const breathe = motion({ scale: 1 })
    .to({ scale: 1.035 }, D / 4, ease.inOut)
    .to({ scale: 1 }, D / 4, ease.inOut)
    .to({ scale: 1.035 }, D / 4, ease.inOut)
    .to({ scale: 1 }, D / 4, ease.inOut);

  const head = at(150, 70);

  const zees = [0, 1, 2].map((i) => {
    const t = (i * D) / 3;

    return (
      <text
        x={head.x}
        y={head.y}
        fontFamily={mono}
        fontSize={28 + i * 8}
        fontWeight={700}
        fill="#cfd8ff"
        animation={motion({ x: 0, y: 0, opacity: 0 })
          .at(t)
          .to({ x: 30, y: -50, opacity: 1 }, 0.8, ease.out)
          .to({ x: 70, y: -130, opacity: 0 }, 1.2, ease.in)}
      >
        z
      </text>
    );
  });

  const bulb = at(104, 38);

  const halo = motion({ opacity: 0.25, scale: 0.9 })
    .to({ opacity: 0.5, scale: 1.1 }, D / 2, ease.inOut)
    .to({ opacity: 0.25, scale: 0.9 }, D / 2, ease.inOut);

  const fireflies = [
    [700, 330],
    [860, 420],
    [960, 300],
    [640, 260],
    [1040, 470],
  ].map(([x, y], i) => (
    <circle
      cx={x}
      cy={y}
      r={4}
      fill="#FFF3B0"
      animation={[
        wiggle({ x: 30, y: 24 }, { seed: `fly-${i}`, rate: 0.5 }),
        motion({ opacity: 0.2 })
          .at(i * 0.8)
          .to({ opacity: 1 }, 0.6, ease.inOut)
          .to({ opacity: 0.2 }, 0.9, ease.inOut),
      ]}
    />
  ));

  const stars = [
    [120, 90],
    [300, 160],
    [520, 70],
    [700, 140],
    [880, 60],
    [1180, 220],
    [80, 300],
  ].map(([x, y], i) => (
    <circle
      cx={x}
      cy={y}
      r={2.5}
      fill="#eef1ff"
      animation={motion({ opacity: 1 })
        .at(i * 0.7)
        .to({ opacity: 0.3 }, 0.4)
        .to({ opacity: 1 }, 0.6)}
    />
  ));

  const petals = Array.from({ length: 6 }, (_, i) => (
    <ellipse cx={0} cy={-26} rx={15} ry={24} fill="#FF8FB1" transform={`rotate(${i * 60})`} />
  ));

  return render(
    {
      width: W,
      height: H,
      duration: D,
      title: "The chick by day and by night",
      desc: "In light mode the svjeez chick bounces beside an open flower under the sun while a butterfly loops around. In dark mode, in the same file, it sleeps under the moon with its bulb as a night-light, Zs drifting up, the flower closed and fireflies blinking.",
      reducedMotion: { at: 0.3 },
      css: cssTag(Object.assign([paint + MOODS, ""], { raw: [paint + MOODS, ""] }), SQUASH),
    },
    <>
      <rect width={W} height={H} fill={vars.sky} />
      <g class="day">
        <circle cx={220} cy={150} r={70} fill={CHICK.yellow} />
      </g>
      <g class="night">
        {stars}
        <circle cx={1060} cy={150} r={64} fill="#f3ecd2" />
        <circle cx={1088} cy={128} r={56} fill={vars.sky} />
      </g>
      <path d={`M0 520C260 450 520 470 760 500S1100 470 ${W} 480V${H}H0Z`} fill={vars.far} />
      <path d={`M0 600C300 560 700 570 ${W} 600V${H}H0Z`} fill={vars.hill} />

      {/* The flower: open by day, a closed bud by night. */}
      <Pivot origin={{ x: FLOWER.x, y: FLOWER.base }} animation={sway}>
        <path
          d={`M${FLOWER.x} ${FLOWER.base}C${FLOWER.x - 20} 500 ${FLOWER.x + 20} 440 ${FLOWER.x} ${FLOWER.head}`}
          stroke={vars.stem}
          strokeWidth={8}
          strokeLinecap="round"
          fill="none"
        />
        <ellipse
          cx={FLOWER.x - 26}
          cy={500}
          rx={26}
          ry={10}
          fill={vars.stem}
          transform={`rotate(-25 ${FLOWER.x - 26} 500)`}
        />
        <g class="day" transform={`translate(${FLOWER.x} ${FLOWER.head})`}>
          {petals}
          <circle r={16} fill={CHICK.yellow} />
        </g>
        <g class="night" transform={`translate(${FLOWER.x} ${FLOWER.head})`}>
          <path d="M0 -40C22 -20 18 10 0 14C-18 10 -22 -20 0 -40Z" fill="#c76b8a" />
        </g>
      </Pivot>

      {/* Day: awake and bouncing, with a butterfly about. */}
      <g class="day">
        <g transform={placed}>
          {chick({
            blinks: [1.6, 4.6],
            body: hops.body,
            stretch: hops.stretch,
            bulb: hops.bulb,
            look: motion({ x: 5, y: -3 }),
            feet: {},
          })}
        </g>
        <g animation={butterfly}>
          <g animation={flap}>
            <path d="M0 0L-22 -18L-18 10Z" fill="#7C9CFF" />
            <path d="M0 0L22 -18L18 10Z" fill="#7C9CFF" />
          </g>
          <ellipse rx={3} ry={9} fill="#2b2b3a" />
        </g>
      </g>

      {/* Night: asleep, breathing, with its bulb glowing as a night-light. */}
      <g class="night">
        <g transform={`translate(${bulb.x} ${bulb.y})`}>
          <g animation={halo}>
            <circle r={60} fill="#FFC94D" opacity={0.16} />
            <circle r={34} fill="#FFD76B" opacity={0.3} />
          </g>
        </g>
        <g transform={placed}>
          <Pivot origin={GROUND} animation={breathe}>
            {chick({ glow: motion({ fill: "#FFF3B0" }), feet: {} })}
            {[84, 124].map((x) => (
              <>
                <ellipse cx={x} cy={110} rx={10} ry={12} fill={CHICK.yellow} />
                <path
                  d={`M${x - 8} 110Q${x} 117 ${x + 8} 110`}
                  fill="none"
                  stroke={CHICK.ink}
                  strokeWidth={3.5}
                  strokeLinecap="round"
                />
              </>
            ))}
          </Pivot>
        </g>
        {zees}
        {fireflies}
      </g>
    </>,
  );
}
