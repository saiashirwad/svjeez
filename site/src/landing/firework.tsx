import { draw, ease, motion, render } from "svjeez";
import { color, count, defaults, number, type Handles, type Values } from "svjeez/params";

export const params = {
  sparks: count(16, { min: 3, max: 40 }),
  reach: number(120, { min: 30, max: 200, step: 1, unit: "px" }),
  fall: number(70, { min: 0, max: 160, step: 1, unit: "px" }),
  color: color("#FFC21A"),
};

const burst = { x: 280, y: 130 };

export const handles: Handles<typeof params> = (p) => ({
  reach: { x: burst.x - p.reach, y: burst.y },
  fall: { x: burst.x, y: burst.y + p.reach + p.fall },
});

export default (p: Values<typeof params> = defaults(params)) => {
  // Two rings of sparks: the outer one in your color, the inner one coral and a beat later.
  const rings = [
    { size: 1, fill: p.color, at: 0.8 },
    { size: 0.55, fill: "#FF8C6B" as const, at: 0.9 },
  ];

  const sparks = rings.flatMap((ring, r) =>
    Array.from({ length: p.sparks }, (_, i) => {
      const angle = ((i + r / 2) / p.sparks) * 2 * Math.PI;
      const x = Math.cos(angle) * p.reach * ring.size;
      const y = Math.sin(angle) * p.reach * ring.size;

      const fly = motion({ x: 0, y: 0, opacity: 0, scale: 1 })
        .at(ring.at)
        .set({ opacity: 1 })
        .to({ x, y }, 0.7, ease.out)
        .to({ y: y + p.fall, opacity: 0, scale: 0.2 }, 1, ease.in);

      return <circle cx={burst.x} cy={burst.y} r={6 - r * 2} fill={ring.fill} animation={fly} />;
    }),
  );

  const rocket = [
    draw({ at: 0, over: 0.8 }, ease.in),
    motion({ opacity: 1 }).at(0.8).to({ opacity: 0 }, 0.2),
  ];

  const flash = motion({ opacity: 0, scale: 0.2 })
    .at(0.8)
    .to({ opacity: 0.35, scale: 1 }, 0.1)
    .to({ opacity: 0 }, 0.4);

  return render(
    { width: 560, height: 360, duration: 3, title: "A firework" },
    <>
      <rect width={560} height={360} fill="#1B1A2E" />
      <path d={`M${burst.x} 360V${burst.y}`} stroke={p.color} strokeWidth={3} animation={rocket} />
      <circle cx={burst.x} cy={burst.y} r={p.reach / 3} fill={p.color} animation={flash} />
      {sparks}
    </>,
  );
};
