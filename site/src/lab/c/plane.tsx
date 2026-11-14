import { ease, motion, render, sampled, shake, spline } from "svjeez";

type Point = [x: number, y: number];

// A paper plane's flight, leg by leg: fly to `to` in `over` seconds.
// feel > 0 leaves fast and lands slow; feel < 0 leaves slow and lands fast.
const launch = 0.4;
const from: Point = [-30, 215];

const legs: { to: Point; over: number; feel: number }[] = [
  { to: [150, 80], over: 1.5, feel: 0.5 },
  { to: [300, 175], over: 1.2, feel: 0 },
  { to: [450, 70], over: 1.4, feel: -0.4 },
  { to: [680, 125], over: 1.6, feel: 0.3 },
];

const duration = 8;

const trees: Point[] = [
  [90, 232],
  [250, 238],
  [372, 246],
  [560, 236],
];

const curve = (u: number, f: number) => (f < 0 ? u ** (1 - 3 * f) : 1 - (1 - u) ** (1 + 3 * f));

// A smooth route through the points: leg i runs from position i to i + 1.
const route = spline([from, ...legs.map((leg) => leg.to)].map(([x, y]) => ({ x, y })));

const fly = (t: number) => {
  let start = launch;
  let i = 0;

  while (i < legs.length - 1 && t > start + legs[i]!.over) start += legs[i++]!.over;
  const leg = legs[i]!;
  const u = curve(Math.min(1, Math.max(0, (t - start) / leg.over)), leg.feel);
  const { x, y } = route.point(i + u);

  return { x, y, rotate: route.angle(i + u) };
};

/** When the plane first reaches `x`, if it does. */
const when = (x: number) => {
  for (let t = 0; t < duration - 2; t += 0.02) if (fly(t).x >= x) return t;

  return undefined;
};

const end = launch + legs.reduce((sum, leg) => sum + leg.over, 0);
const puffs = Array.from({ length: 60 }, (_, k) => launch + k * 0.12).filter((t) => t < end);

export default () =>
  render(
    {
      width: 640,
      height: 300,
      duration,
      title: "Paper plane",
      desc: "A paper plane loops over hills, trees shiver as it passes and birds scatter.",
    },
    <>
      <rect width={640} height={300} fill="#CFE8FF" />
      <circle cx={540} cy={70} r={30} fill="#FFD66B" />
      <path d="M0 230Q160 170 330 225T640 210V300H0Z" fill="#A8D8B0" />
      <path d="M0 262Q200 236 420 258T640 250V300H0Z" fill="#5FB27F" />
      {trees.map(([x, y]) => {
        const t = when(x);
        const close = t === undefined ? 0 : Math.max(0, 1 - Math.abs(fly(t).y - y) / 150);

        return (
          <g
            animation={
              t !== undefined && close > 0.05
                ? shake({ at: t, over: 1 }, { rotate: 24 * close })
                : undefined
            }
          >
            <rect x={x - 2} y={y} width={4} height={16} fill="#6B4A32" />
            <circle cx={x} cy={y - 4} r={14} fill="#2F7A4E" />
          </g>
        );
      })}
      {[0, 1, 2].map((k) => {
        const t = when(470 + 12 * k);

        return (
          <path
            d={`M${464 + 12 * k} ${250 - k}l4 3 4-3`}
            fill="none"
            stroke="#24324A"
            strokeWidth={1.6}
            animation={
              t === undefined
                ? undefined
                : motion({ opacity: 1 })
                    .at(t)
                    .to({ x: 40 + 20 * k, y: -110 - 14 * k, opacity: 0 }, 1.2, ease.in)
                    .at(duration - 0.5)
                    .set({ x: 0, y: 0 })
                    .to({ opacity: 1 }, 0.4)
            }
          />
        );
      })}
      {puffs.map((t) => (
        <circle
          cx={fly(t).x}
          cy={fly(t).y}
          r={5}
          fill="#FFFFFF"
          animation={motion({ opacity: 0, scale: 0.5 })
            .at(t)
            .to({ opacity: 0.9, scale: 1 }, 0.1)
            .to({ opacity: 0, scale: 2.4 }, 1)}
        />
      ))}
      <g animation={sampled(fly, { duration, tolerance: { translate: 0.5, rotate: 1 } })}>
        <path
          d="M-19 -12L22 0L-19 12L-11 0Z"
          fill="#FFFFFF"
          stroke="#24324A"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      </g>
    </>,
  );
