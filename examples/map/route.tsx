import {
  def,
  ease,
  enter,
  motion,
  rect,
  type Child,
  type Point,
  type Rect,
  type SvgNode,
} from "svjeez";
import { Camera, travel, type CameraStop } from "svjeez/extras";
import { trace } from "./curve";
import { C, H, W, n } from "./kit";
import { CINDER, PLACES } from "./places";

const STEPS = 24;

const POINTS: Point[] = [
  PLACES.bramblecott.at,
  { x: 286, y: 330 },
  PLACES.ford.at,
  { x: 396, y: 392 },
  PLACES.elder.at,
  { x: 520, y: 392 },
  PLACES.pass.at,
  { x: 640, y: 372 },
  PLACES.ashfall.at,
  { x: 742, y: 372 },
  CINDER,
];

const ROUTE = trace(POINTS, STEPS);
const JOURNEY = { at: 6, over: 9.5 };

/** When the traveller reaches one of the route's points. */
const reach = (p: Point) =>
  JOURNEY.at + (JOURNEY.over * ROUTE.len[POINTS.indexOf(p) * STEPS]!) / ROUTE.total;

const view = (center: Point, width: number): Rect =>
  rect(center.x - width / 2, center.y - width / 3, width, (width * 2) / 3);

const PAN = 1.1;

const STOPS: CameraStop[] = [
  { during: { at: 5, over: PAN }, target: view(PLACES.bramblecott.at, 300) },
  ...[PLACES.ford.at, PLACES.elder.at, PLACES.pass.at, PLACES.ashfall.at].map((p) => ({
    during: { at: reach(p) - PAN * 0.8, over: PAN },
    target: view(p, 320),
  })),
  {
    during: { at: reach(CINDER) - PAN * 0.6, over: PAN },
    target: view({ x: CINDER.x - 6, y: CINDER.y - 22 }, 210),
  },
  { during: { at: 18.2, over: PAN }, target: "all" },
];

/** The camera. The map and what moves over it each ride one, so they zoom together. */
export const Follow = ({ children }: { children: Child }): SvgNode => (
  <Camera frame={rect(0, 0, W, H)} stops={STOPS} over={PAN}>
    {children}
  </Camera>
);

/**
 * The dashed route, revealed in short pieces as the traveller passes. A mask that draws on would be simpler, but a masked
 * element inside the zooming camera makes Chromium re-raster the whole map each frame, and tiles flash blank mid-zoom.
 */
function Route(): SvgNode {
  const { pts, len, total } = ROUTE;
  const piece = 6;

  return (
    <g fill="none" stroke={C.red} strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round">
      {Array.from({ length: Math.ceil((pts.length - 1) / piece) }, (_, k) => (
        <path
          d={pts
            .slice(k * piece, k * piece + piece + 1)
            .map((p, i) => `${i ? "L" : "M"}${n(p.x)} ${n(p.y)}`)
            .join("")}
          strokeDashoffset={-n(len[k * piece]!)}
          animation={motion({ opacity: 0 })
            .at(JOURNEY.at + (JOURNEY.over * len[k * piece]!) / total)
            .set({ opacity: 1 })}
        />
      ))}
    </g>
  );
}

/** The glow and smoke over Mount Cinder, which loop forever. */
function Smoke(): SvgNode {
  const { x, y } = CINDER;
  const top = y - 54;

  const glow = def.radialGradient(
    {},
    <>
      <stop offset={0} stopColor={C.ember} stopOpacity={0.7} />
      <stop offset={1} stopColor={C.ember} stopOpacity={0} />
    </>,
  );

  return (
    <g animation={enter({ at: 2.2, over: 0.6 })}>
      <ellipse
        cx={x}
        cy={top}
        rx={70}
        ry={52}
        fill={glow}
        animation={motion({ opacity: 0.55 })
          .to({ opacity: 1 }, 1.1, ease.inOut)
          .to({ opacity: 0.55 }, 1.1, ease.inOut)
          .loop(2.2)}
      />
      {[0, 1, 2].map((i) => (
        <circle
          cx={x + 1}
          cy={top - 6}
          r={6}
          fill={C.faded}
          animation={motion({ opacity: 0, y: 0, x: 0, scale: 0.5 })
            .at(i * 1.1)
            .to({ opacity: 0.55 }, 0.3)
            .to({ opacity: 0, y: -38, x: 12 + i * 3, scale: 2 }, 1.8, ease.out)
            .loop(4.4)}
        />
      ))}
    </g>
  );
}

/**
 * What keeps moving while the camera does: the smoke, the route, the traveller and the cross. Chromium re-rasters a
 * zooming layer whenever anything inside it changes, and a whole map re-rastered every frame shows blank tiles, so these
 * ride a second camera.
 */
export function Live(): SvgNode {
  return (
    <Follow>
      <Smoke />
      <Route />
      <g
        animation={travel(
          ROUTE.pts.filter((_, i) => i % 12 === 0),
          JOURNEY,
        )}
      >
        <circle r={5.5} fill={C.red} opacity={0.25} />
        <circle r={3} fill={C.red} stroke={C.land} strokeWidth={1} />
      </g>
      <path
        d={`M${CINDER.x - 6} ${CINDER.y + 8}l12 12M${CINDER.x + 6} ${CINDER.y + 8}l-12 12`}
        stroke={C.red}
        strokeWidth={2.6}
        strokeLinecap="round"
        animation={motion({ opacity: 0, scale: 0.3 })
          .at(reach(CINDER))
          .to({ opacity: 1, scale: 1 }, 0.5, ease.pop)}
      />
    </Follow>
  );
}
