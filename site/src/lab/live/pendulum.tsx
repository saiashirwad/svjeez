import { Pivot, render, sampled } from "svjeez";
import { defaults, number, type Handles, type Values } from "svjeez/params";

export const params = {
  length: number(190, { min: 80, max: 240, step: 1 }),
  swing: number(30, { min: 10, max: 50, step: 1, unit: "°" }),
  bob: number(20, { min: 12, max: 32, step: 1 }),
};

const pivot = { x: 240, y: 36 };

/** The point `r` from the pivot along a rod turned `deg` degrees from hanging straight down. */
const along = (r: number, deg: number) => ({
  x: pivot.x + r * Math.sin((deg * Math.PI) / 180),
  y: pivot.y + r * Math.cos((deg * Math.PI) / 180),
});

/** Each handle sits on the thing its value draws: the bottom of the arc, its far end, the rim of the bob. */
export const handles: Handles<typeof params> = (p) => ({
  length: along(p.length, 0),
  swing: along(p.length, -p.swing),
  bob: along(p.length + p.bob, p.swing),
});

export default (p: Values<typeof params> = defaults(params)) => {
  // A real pendulum's period, so a longer rod swings slower.
  const period = 2 * Math.PI * Math.sqrt(p.length / 2000);

  const swinging = sampled((t) => ({ rotate: -p.swing * Math.cos((2 * Math.PI * t) / period) }), {
    duration: period,
    tolerance: { rotate: 0.2 },
  });

  const left = along(p.length, -p.swing);
  const rest = along(p.length, 0);
  const right = along(p.length, p.swing);

  return render(
    {
      width: 480,
      height: 320,
      duration: period,
      title: "Pendulum",
      desc: "A pendulum swings from where it was let go. A longer rod swings slower.",
    },
    <>
      <rect width={480} height={320} fill="#15131A" />
      <path
        d={`M${left.x} ${left.y}A${p.length} ${p.length} 0 0 0 ${right.x} ${right.y}`}
        fill="none"
        stroke="#4A4357"
        strokeWidth={2}
        strokeDasharray="1 7"
        strokeLinecap="round"
      />
      <circle
        cx={right.x}
        cy={right.y}
        r={p.bob}
        fill="none"
        stroke="#F2B84B"
        strokeOpacity={0.35}
      />
      <Pivot at={pivot} animation={swinging}>
        <line x1={pivot.x} y1={pivot.y} x2={rest.x} y2={rest.y} stroke="#D9D2E3" strokeWidth={2} />
        <circle cx={rest.x} cy={rest.y} r={p.bob} fill="#F2B84B" />
        <circle cx={rest.x - p.bob / 3} cy={rest.y - p.bob / 3} r={p.bob / 3} fill="#FFE3A6" />
      </Pivot>
      <circle cx={pivot.x} cy={pivot.y} r={5} fill="#D9D2E3" />
    </>,
  );
};
