import { Ink, def, enter, tool, type Point, type SvgNode } from "svjeez";
import { pts, smooth, trace } from "./curve";
import { C, H, W, n, pathSymbol, random, type Play } from "./kit";
import { CINDER } from "./places";

/** A coastline: an ellipse pushed in and out by a few seeded waves. */
const shore = (
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  seed: number,
  rough = 1,
  count = 96,
): string => {
  const rand = random(seed);

  const waves = [2, 3, 4, 5, 7, 9, 13, 17].map((k) => ({
    k,
    a: (0.12 / Math.sqrt(k)) * rough * (0.5 + rand()),
    phase: rand() * Math.PI * 2,
  }));

  const pts = Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2;
    const r = 1 + waves.reduce((sum, w) => sum + w.a * Math.sin(w.k * angle + w.phase), 0);

    return { x: cx + rx * r * Math.cos(angle), y: cy + ry * r * Math.sin(angle) };
  });

  return smooth(pts, true);
};

const LAND = [
  shore(490, 334, 392, 226, 7),
  shore(96, 548, 46, 26, 3, 1.4, 28),
  shore(70, 168, 26, 16, 11, 1.4, 24),
  shore(912, 120, 20, 30, 5, 1.6, 24),
].join("");

const landSymbol = pathSymbol(LAND);
const landClip = def.clipPath({}, <path d={LAND} />);

/** A broad nib for coasts, a fine pen for peaks, a brush for rivers and lava. */
const COAST = tool.nib({ size: 2.6, angle: 40, thin: 0.35 });
const PEN = tool.pen({ size: 1.05, seed: 4 });
const CONE = tool.pen({ size: 1.5, seed: 8 });
const HATCH = tool.pen({ size: 0.65, taper: 0.3, seed: 5 });
const RIVER = tool.brush({ size: 2.6, taper: 0.18, pressure: 0.3, seed: 6 });
const CREEK = tool.brush({ size: 1.7, taper: 0.25, seed: 7 });
const LAVA = tool.brush({ size: 2.8, taper: 0.4, seed: 9 });

const RIPPLES = [
  { width: 26, color: C.faded, opacity: 0.18 },
  { width: 21, color: C.sea, opacity: 1 },
  { width: 13, color: C.faded, opacity: 0.35 },
  { width: 9, color: C.sea, opacity: 1 },
];

/** The sea, the rippled shallows, the land and its inked shore. */
function Coast({ play }: { play: Play }): SvgNode {
  return (
    <>
      <rect width={W} height={H} fill={C.sea} />
      <g animation={play(enter({ at: 0.2, over: 1 }))}>
        {RIPPLES.map(({ width, color, opacity }, i) => (
          <use
            href={landSymbol}
            fill="none"
            stroke={color}
            strokeWidth={width}
            strokeLinejoin="round"
            opacity={opacity}
            animation={play(enter({ at: 0.2 + i * 0.15, over: 0.8 }))}
          />
        ))}
      </g>
      <use href={landSymbol} fill={C.land} animation={play(enter({ at: 0.1, over: 1 }))} />
      <Ink d={LAND} tool={COAST} fill={C.ink} draw={play({ at: 0.1, over: 1.6 })} />
    </>
  );
}

const RIVERS: Point[][] = [
  pts([300, 196, 330, 260, 352, 304, 330, 360, 318, 440, 290, 520, 270, 600]),
  pts([600, 300, 650, 330, 690, 432, 730, 500, 780, 600]),
  pts([470, 230, 440, 270, 395, 300, 352, 304]),
];

/** Rivers, and the lake where two of them meet, kept inside the coast. */
function Rivers({ play }: { play: Play }): SvgNode {
  return (
    <g clipPath={landClip}>
      {RIVERS.map((river, i) => (
        <Ink
          d={smooth(river)}
          tool={i === 2 ? CREEK : RIVER}
          fill={C.river}
          draw={play({ at: 1.8 + i * 0.3, over: 1.4 })}
        />
      ))}
      <ellipse
        cx={352}
        cy={304}
        rx={16}
        ry={8}
        fill={C.sea}
        stroke={C.river}
        strokeWidth={1}
        animation={play(enter({ at: 2.4, over: 0.6 }))}
      />
    </g>
  );
}

interface Wood {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
  readonly seed: number;
  readonly at: number;
}

const WOODS: Wood[] = [
  { cx: 420, cy: 330, rx: 68, ry: 40, seed: 21, at: 1.6 },
  { cx: 268, cy: 440, rx: 46, ry: 26, seed: 22, at: 1.8 },
  { cx: 545, cy: 470, rx: 60, ry: 30, seed: 23, at: 2 },
  { cx: 196, cy: 230, rx: 44, ry: 24, seed: 24, at: 1.9 },
  { cx: 740, cy: 196, rx: 56, ry: 26, seed: 25, at: 2.1 },
  { cx: 420, cy: 520, rx: 40, ry: 18, seed: 26, at: 2.2 },
];

/** Lollipop trees scattered inside an ellipse, in four bands that fade in one after another. */
function Forest({ cx, cy, rx, ry, seed, at, play }: Wood & { play: Play }): SvgNode {
  const rand = random(seed);
  const trees: Point[] = [];

  for (let y = cy - ry; y <= cy + ry; y += 7) {
    for (let x = cx - rx; x <= cx + rx; x += 8) {
      const p = { x: x + (rand() - 0.5) * 5, y: y + (rand() - 0.5) * 4 };

      if (((p.x - cx) / rx) ** 2 + ((p.y - cy) / ry) ** 2 <= 1 - rand() * 0.25) trees.push(p);
    }
  }

  trees.sort((a, b) => a.y - b.y);

  return (
    <g stroke={C.ink} strokeWidth={0.8} fill={C.land}>
      {[0, 1, 2, 3].map((band) => (
        <use
          href={pathSymbol(
            trees
              .slice(
                Math.ceil((band * trees.length) / 4),
                Math.ceil(((band + 1) * trees.length) / 4),
              )
              .map(
                ({ x, y }) =>
                  `M${n(x)} ${n(y)}v3M${n(x - 3.2)} ${n(y)}a3.2 3.6 0 1 1 6.4 0a3.2 1.6 0 0 1 -6.4 0Z`,
              )
              .join(""),
          )}
          animation={play(enter({ at: at + band * 0.15, over: 0.5 }))}
        />
      ))}
    </g>
  );
}

interface Chain {
  readonly spine: Point[];
  readonly seed: number;
  readonly size?: number;
  readonly spacing: number;
  readonly at: number;
}

const CHAINS: Chain[] = [
  {
    spine: pts([560, 160, 590, 240, 600, 320]),
    seed: 31,
    spacing: 12,
    at: 1.2,
  },
  {
    spine: pts([600, 392, 590, 450, 612, 516]),
    seed: 32,
    spacing: 12,
    at: 1.4,
  },
  {
    spine: pts([150, 430, 196, 470, 240, 500]),
    seed: 35,
    size: 14,
    spacing: 11,
    at: 1.6,
  },
  {
    spine: pts([268, 190, 300, 176, 340, 186]),
    seed: 33,
    size: 18,
    spacing: 12,
    at: 1.5,
  },
  {
    spine: pts([720, 300, 772, 280, 822, 310, 830, 370]),
    seed: 34,
    size: 16,
    spacing: 11,
    at: 1.7,
  },
];

/** A range of peaks along a line, each a little inked tent with hatching down its shadowed side. */
function Range({ spine, seed, size = 22, spacing, at, play }: Chain & { play: Play }): SvgNode {
  const rand = random(seed);
  const line = trace(spine, 24);
  const peaks: { x: number; y: number; h: number; w: number }[] = [];

  for (let s = 0; s < line.total; s += spacing * (0.7 + rand() * 0.6)) {
    const p = line.at(s);

    for (let k = 0; k < (rand() < 0.5 ? 2 : 1); k++) {
      const h = size * (0.65 + rand() * 0.5);
      peaks.push({
        x: p.x + (rand() - 0.5) * spacing * 1.6,
        y: p.y + (rand() - 0.5) * spacing * 1.4,
        h,
        w: h * (1.15 + rand() * 0.35),
      });
    }
  }

  return (
    <g>
      {peaks
        .sort((a, b) => a.y - b.y)
        .map(({ x, y, h, w }, i) => {
          const top = { x: x - w * 0.06, y: y - h };

          const hatch = [0.18, 0.34, 0.5, 0.66, 0.82]
            .map((t) => {
              const sx = top.x + (x + w / 2 - top.x) * t;
              const sy = top.y + (y - top.y) * t;

              return `M${n(sx)} ${n(sy)}L${n(sx - w * 0.1)} ${n(Math.min(y, sy + h * 0.32))}`;
            })
            .join("");

          const body = `M${n(x - w / 2)} ${n(y)}Q${n(x - w * 0.3)} ${n(y - h * 0.55)} ${n(top.x)} ${n(top.y)}L${n(x + w * 0.12)} ${n(y - h * 0.72)}L${n(x + w * 0.2)} ${n(y - h * 0.78)}L${n(x + w / 2)} ${n(y)}`;

          return (
            <g
              animation={play(
                enter({ at: at + Math.floor(i / 4) * 0.05, over: 0.35 }, { opacity: 0, y: 4 }),
              )}
            >
              <use href={pathSymbol(`${body}Z`)} fill={C.land} />
              <Ink d={body} tool={PEN} fill={C.ink} />
              <Ink d={hatch} tool={HATCH} fill={C.ink} />
            </g>
          );
        })}
    </g>
  );
}

/** Mount Cinder: a cone with a rim, hatching down its flank and two lava runs. */
function Volcano({ at, play }: { at: number; play: Play }): SvgNode {
  const { x, y } = CINDER;
  const rim = { l: x - 9, r: x + 9, y: y - 54 };
  const body = `M${x - 52} ${y}Q${x - 40} ${y - 6} ${x - 34} ${y - 16}L${x - 26} ${y - 24}L${x - 22} ${y - 22}L${rim.l} ${rim.y}Q${x} ${rim.y + 5} ${rim.r} ${rim.y}L${x + 20} ${y - 30}L${x + 26} ${y - 32}L${x + 36} ${y - 14}Q${x + 42} ${y - 4} ${x + 52} ${y}Z`;

  const hatch = Array.from({ length: 9 }, (_, i) => {
    const t = (i + 1) / 10;
    const [sx, sy] = [rim.r + (x + 52 - rim.r) * t, rim.y + (y - rim.y) * t];

    return `M${n(sx)} ${n(sy)}l${n(-6 - t * 4)} ${n(10 + t * 6)}`;
  }).join("");

  const lava = `M${x - 4} ${rim.y + 2}q-3 10 -9 16q-4 6 -10 22M${x + 2} ${rim.y + 3}q4 14 2 22q2 8 9 18`;

  return (
    <g animation={play(enter({ at, over: 0.6 }, { opacity: 0, y: 6 }))}>
      <use href={pathSymbol(body)} fill={C.land} />
      <Ink d={body} tool={CONE} fill={C.ink} />
      <Ink d={hatch} tool={HATCH} fill={C.ink} />
      <Ink d={`M${rim.l} ${rim.y}Q${x} ${rim.y - 4} ${rim.r} ${rim.y}`} tool={PEN} fill={C.ink} />
      <Ink d={lava} tool={LAVA} fill={C.red} />
    </g>
  );
}

/** Land, water and everything drawn on it: coast, rivers, forests, ranges and the volcano. */
export function Terrain({ play }: { play: Play }): SvgNode {
  return (
    <>
      <Coast play={play} />
      <Rivers play={play} />
      {WOODS.map((wood) => (
        <Forest {...wood} play={play} />
      ))}
      {CHAINS.map((chain) => (
        <Range {...chain} play={play} />
      ))}
      <Volcano at={2.2} play={play} />
    </>
  );
}
