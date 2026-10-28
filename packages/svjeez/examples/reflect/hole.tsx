import { def, ease, el, motion, sampled, wiggle, type SvgNode } from "svjeez";
import { C, D, FRAME, O, random } from "./theme";

const pivot = { transformBox: "view-box", transformOrigin: "0 0" } as const;

const centered = `translate(${O.x} ${O.y})`;

const vignette = def.radialGradient({}, (
  <>
    <stop offset={0.61} stopColor="#FFF" />
    <stop offset={1} stopColor="#FFF" stopOpacity={0} />
  </>
));

const fade = def.mask(
  { maskUnits: "userSpaceOnUse", x: 0, y: 344, width: 1440, height: 810 },
  <rect x={0} y={344} width={1440} height={810} fill={vignette} />,
);

const crown = (r: number) => {
  const box = { x: -r - 8, y: -r - 8, width: 2 * r + 16, height: 2 * r + 16 };
  const ramp = def.linearGradient({ gradientUnits: "userSpaceOnUse", x1: 0, y1: -r, x2: 0, y2: r }, [
    el.stop({ offset: 0.0941, stopColor: "#FFF", stopOpacity: 0.6 }),
    el.stop({ offset: 0.2979, stopColor: "#FFF", stopOpacity: 0 }),
  ]);
  return def.mask({ maskUnits: "userSpaceOnUse", ...box }, el.rect({ ...box, fill: ramp }));
};

const ORBITS = [
  { r: 404, opacity: 1, turns: true },
  { r: 304, opacity: 0.6, turns: true },
  { r: 208, opacity: 1, turns: false },
] as const;

const orbit = motion({ rotate: 0 }).to({ rotate: 270 }, D, ease.linear);

export function Orbits(): SvgNode {
  return (
    <g mask={fade}>
      <g transform={centered}>
        {ORBITS.map(({ r, opacity, turns }) =>
          el.g(
            { mask: crown(r), opacity },
            el.g({ style: pivot, animation: turns ? orbit : undefined, fill: C.violet, fillOpacity: 0.04, stroke: C.violet, strokeOpacity: 0.3 }, [
              el.circle({ r }),
              Array.from({ length: 8 }, (_, i) =>
                el.circle({ cx: r * Math.cos((i * Math.PI) / 4), cy: r * Math.sin((i * Math.PI) / 4), r: 3, fillOpacity: 0.01 }),
              ),
            ]),
          ),
        )}
      </g>
    </g>
  );
}

const rand = random(2023);

const ringAlpha = (u: number): number => {
  if (u < 0.2708 || u > 1) return 0;
  if (u < 0.4792) return (u - 0.2708) / (0.4792 - 0.2708);
  if (u < 0.75) return 1 - (0.2 * (u - 0.4792)) / (0.75 - 0.4792);
  return (0.8 * (1 - u)) / 0.25;
};

const STARS = Array.from({ length: 150 }, (_, i) => {
  const x = (rand() * 2 - 1) * 350;
  const y = (rand() * 2 - 1) * 350;
  const angle = rand() * Math.PI * 2;
  const reach = 6 + rand() * 22;
  return {
    x,
    y,
    alpha: ringAlpha(Math.hypot(x, y) / 350) * (i % 3 === 0 ? 0.5 : 1),
    period: D / (8 + Math.floor(rand() * 10)),
    phase: rand(),
    dx: Math.cos(angle) * reach,
    dy: Math.sin(angle) * reach,
  };
}).filter((star) => star.alpha > 0.04);

const twinkle = ({ period, phase, dx, dy }: (typeof STARS)[number]) =>
  sampled(
    (t) => {
      const u = (t / period + phase) % 1;
      return { opacity: Math.min(1, u / 0.1), x: dx * u, y: dy * u, scale: 1 - 0.5 * u };
    },
    { duration: period, tolerance: { opacity: 0.03, translate: 0.3, scale: 0.02 } },
  ).loop(period);

export function Stars(): SvgNode {
  return (
    <g mask={fade}>
      <g transform={centered}>
        <g style={pivot} animation={motion({ rotate: 0 }).to({ rotate: -360 }, D, ease.linear)} fill="#FFF">
          {STARS.map((star) =>
            el.g({ opacity: star.alpha }, el.circle({ cx: star.x, cy: star.y, r: 1, animation: twinkle(star) })),
          )}
        </g>
      </g>
    </g>
  );
}

const lensing = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 170 }, (
  <>
    <stop offset={0} stopColor="#2E1478" />
    <stop offset={0.3} stopColor="#3D1C96" />
    <stop offset={0.38} stopColor="#6A3FD8" stopOpacity={0.95} />
    <stop offset={0.43} stopColor="#E9D5FF" />
    <stop offset={0.46} stopColor="#FFF" />
    <stop offset={0.5} stopColor="#FFF6FF" />
    <stop offset={0.53} stopColor="#F3D9FF" stopOpacity={0.95} />
    <stop offset={0.57} stopColor="#FFF" stopOpacity={0.9} />
    <stop offset={0.61} stopColor="#E6C8FF" stopOpacity={0.85} />
    <stop offset={0.65} stopColor="#F5E6FF" stopOpacity={0.85} />
    <stop offset={0.7} stopColor="#CDA5FF" stopOpacity={0.7} />
    <stop offset={0.75} stopColor="#DDBEFF" stopOpacity={0.6} />
    <stop offset={0.82} stopColor="#A97BFF" stopOpacity={0.45} />
    <stop offset={0.9} stopColor="#8A55F5" stopOpacity={0.25} />
    <stop offset={1} stopColor="#6A3AE8" stopOpacity={0} />
  </>
));

const bloom = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 260 }, (
  <>
    <stop offset={0.3} stopColor="#C9A6FF" stopOpacity={0.55} />
    <stop offset={0.5} stopColor="#9E6BFF" stopOpacity={0.35} />
    <stop offset={1} stopColor="#7A45F0" stopOpacity={0} />
  </>
));

const haze = def.radialGradient({ gradientUnits: "userSpaceOnUse", cx: 0, cy: 0, r: 300, gradientTransform: "scale(0.78 1)" }, (
  <>
    <stop offset={0} stopColor="#9A63FF" stopOpacity={0.85} />
    <stop offset={0.4} stopColor="#6E38F2" stopOpacity={0.5} />
    <stop offset={0.75} stopColor="#4A1FC0" stopOpacity={0.16} />
    <stop offset={1} stopColor="#3A139E" stopOpacity={0} />
  </>
));

const SHIMMER = [
  { r: 80, width: 3, color: "#FFF", opacity: 0.35, turns: 7, dash: "40 26 90 34 18 60" },
  { r: 101, width: 4, color: "#F1DEFF", opacity: 0.28, turns: -5, dash: "70 40 24 50 110 30" },
  { r: 118, width: 5, color: "#D9BCFF", opacity: 0.22, turns: 4, dash: "120 60 30 80" },
  { r: 138, width: 7, color: "#B58CFF", opacity: 0.15, turns: -3, dash: "60 90 140 50" },
] as const;

function Shimmer(): SvgNode {
  return (
    <g fill="none" strokeLinecap="round">
      {SHIMMER.map(({ r, width, color, opacity, turns, dash }) =>
        el.circle({
          r,
          stroke: color,
          strokeOpacity: opacity,
          strokeWidth: width,
          strokeDasharray: dash,
          style: pivot,
          animation: motion({ rotate: 0 })
            .to({ rotate: Math.sign(turns) * 360 }, D / Math.abs(turns), ease.linear)
            .loop(D / Math.abs(turns)),
        }),
      )}
    </g>
  );
}

const above = def.clipPath({}, <rect width={1440} height={FRAME.y + 8} />);

export function Hole(): SvgNode {
  return (
    <g clipPath={above}>
      <g transform={centered}>
        <ellipse rx={234} ry={300} fill={haze} animation={wiggle({ opacity: 0.15 }, { seed: "haze", rate: 0.4, period: D / 5 })} />
        <circle r={260} fill={bloom} />
        <circle r={170} fill={lensing} />
        <Shimmer />
      </g>
    </g>
  );
}

const glass = def.clipPath({}, <rect x={FRAME.x + 8} y={FRAME.y + 8} width={FRAME.width - 16} height={FRAME.height - 16} rx={16} />);

const blob = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor="#4A2BA0" stopOpacity={0.95} />
    <stop offset={0.45} stopColor="#5634BE" stopOpacity={0.9} />
    <stop offset={0.62} stopColor="#A07CF0" stopOpacity={0.7} />
    <stop offset={0.72} stopColor="#DCC8FF" stopOpacity={0.55} />
    <stop offset={0.85} stopColor="#9A70FF" stopOpacity={0.3} />
    <stop offset={1} stopColor="#7C4DFF" stopOpacity={0} />
  </>
));

const disk = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor="#FFF" stopOpacity={0.9} />
    <stop offset={0.25} stopColor="#EAD9FF" stopOpacity={0.75} />
    <stop offset={0.55} stopColor="#A57AFF" stopOpacity={0.45} />
    <stop offset={1} stopColor="#7F4DFF" stopOpacity={0} />
  </>
));

const spill = def.radialGradient({}, (
  <>
    <stop offset={0} stopColor="#7F4DFF" stopOpacity={0.35} />
    <stop offset={1} stopColor="#7F4DFF" stopOpacity={0} />
  </>
));

export function Frost(): SvgNode {
  return (
    <g clipPath={glass} animation={wiggle({ opacity: 0.1 }, { seed: "frost", rate: 0.4, period: D / 5 })}>
      <ellipse cx={O.x} cy={O.y + 10} rx={520} ry={150} fill={spill} />
      <circle cx={O.x} cy={O.y + 22} r={125} fill={blob} />
      <ellipse cx={O.x} cy={O.y + 3} rx={330} ry={46} fill={disk} />
    </g>
  );
}
