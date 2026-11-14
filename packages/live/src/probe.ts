// What a number moves on the picture, found by drawing the file twice, once with the number nudged, and comparing where
// each shape lands. It needs no annotation, so any scene gets a handle on whatever its numbers place or size.
import { restyle, type Point } from "svjeez";

/** Where a handle sits, and which way and how far it moves per unit of its value, in scene units. */
export interface Move {
  readonly at: Point;
  readonly way: Point;
}

const DRAWN = "path,circle,ellipse,rect,line,polyline,polygon,text,use,image,foreignObject";

/** Each box's centre, then the middle of its right and bottom edges: the points a nudge can move. */
const pointsOf = (box: DOMRect): Point[] => [
  { x: box.x + box.width / 2, y: box.y + box.height / 2 },
  { x: box.right, y: box.y + box.height / 2 },
  { x: box.x + box.width / 2, y: box.bottom },
];

/** The boxes of every shape in `svg` held `at` seconds in, in scene units, drawn where layout runs but nothing shows. */
const boxesOf = (svg: string, at: number): DOMRect[] => {
  const host = document.createElement("div");
  host.style.cssText =
    "position:fixed;inset-inline-start:-100000px;inset-block-start:0;visibility:hidden;pointer-events:none";
  // Each copy gets a shadow root of its own, so the two files' keyframes, which share names, never meet.
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = restyle(svg, { at, paused: true });
  document.body.append(host);

  try {
    const picture = root.querySelector("svg");

    if (!picture) return [];
    const frame = picture.getBoundingClientRect();
    const scale = (picture.viewBox.baseVal?.width || frame.width) / (frame.width || 1);

    return [...picture.querySelectorAll(DRAWN)].flatMap((mark) => {
      if (mark.closest("defs,clipPath,mask,pattern,marker,symbol")) return [];
      const box = mark.getBoundingClientRect();

      return [
        new DOMRect(
          (box.x - frame.x) * scale,
          (box.y - frame.y) * scale,
          box.width * scale,
          box.height * scale,
        ),
      ];
    });
  } finally {
    host.remove();
  }
};

const mean = (points: readonly Point[]): Point => ({
  x: points.reduce((sum, p) => sum + p.x, 0) / points.length,
  y: points.reduce((sum, p) => sum + p.y, 0) / points.length,
});

/**
 * How the shapes of `before` that `after` changes move when a value grows `by`: the point that moved the most (a
 * shape's centre when it shifts, its edge when it grows), averaged over those shapes. Undefined when nothing on the
 * picture moved, or the two files draw different shapes.
 */
export const measureMove = async (
  before: string,
  after: string,
  by: number,
  at: number,
): Promise<Move | undefined> => {
  if (!("document" in globalThis)) return undefined;
  const [a, b] = [boxesOf(before, at), boxesOf(after, at)];

  if (!a.length || a.length !== b.length) return undefined;
  const pairs = a.map((box, i) => [pointsOf(box), pointsOf(b[i]!)] as const);

  const moved = pairs.filter(([from, to]) =>
    from.some((p, k) => Math.hypot(to[k]!.x - p.x, to[k]!.y - p.y) > 1e-3),
  );

  if (!moved.length) return undefined;

  const travel = [0, 1, 2].map((k) =>
    moved.reduce(
      (sum, [from, to]) => sum + Math.hypot(to[k]!.x - from[k]!.x, to[k]!.y - from[k]!.y),
      0,
    ),
  );

  const k = travel.indexOf(Math.max(...travel));
  const from = mean(moved.map(([p]) => p[k]!));
  const to = mean(moved.map(([, p]) => p[k]!));

  return { at: from, way: { x: (to.x - from.x) / by, y: (to.y - from.y) / by } };
};
