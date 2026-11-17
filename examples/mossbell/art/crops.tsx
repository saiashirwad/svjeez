/** @jsxImportSource svjeez */
import { ease, motion, Once, span, type SvgNode } from "svjeez";
import { canvas, Pixels, PX, type Canvas } from "./pixel";

export type CropKind = "turnip" | "carrot" | "pumpkin";

/** 0 is seed, 1 a sprout, 2 leaves, 3 ready to pull. */
export type Growth = 0 | 1 | 2 | 3;

/** What each crop is called, what it sells for, and the seconds each stage of growing takes. */
export const CROPS = {
  turnip: { name: "Turnip", price: 8, seconds: 4 },
  carrot: { name: "Carrot", price: 12, seconds: 6 },
  pumpkin: { name: "Pumpkin", price: 20, seconds: 8 },
} as const satisfies {
  readonly [K in CropKind]: {
    readonly name: string;
    readonly price: number;
    readonly seconds: number;
  };
};

const GRID = { width: 18, height: 20, root: [9, 16] } as const;

/** The box a crop is drawn in, and the point where it meets the soil. */
export const CROP = {
  width: GRID.width * PX,
  height: GRID.height * PX,
  root: { x: GRID.root[0] * PX, y: GRID.root[1] * PX },
} as const;

const LEAF = "#5fb85a";
const LEAF_LIT = "#8fd66a";
const RIM = "#2f4a2a";

/** A tuft of leaves that fans out from `x`, `tall` pixels high, standing on row `y`. */
const tuft = (c: Canvas, x: number, y: number, tall: number): Canvas => {
  c.box(x, y - tall, 2, tall, LEAF).dot(x, y - tall, LEAF_LIT);

  for (let i = 1; i <= Math.min(3, tall - 1); i++)
    c.box(x - i, y - tall + i, 1, 2, i === 1 ? LEAF_LIT : LEAF).box(
      x + 1 + i,
      y - tall + i,
      1,
      2,
      LEAF,
    );

  return c;
};

const drawn = (kind: CropKind, growth: Growth): Canvas => {
  const c = canvas(GRID.width, GRID.height).from(1, 1);

  if (growth === 0) {
    for (const x of [2, 7, 12]) c.box(x, 13, 3, 2, "#a8774f").dot(x + 1, 13, "#f0d9a8");

    return c;
  }

  if (growth === 1) return tuft(c, 7, 15, 3).rim(RIM);

  if (growth === 2) return tuft(c, 7, 15, kind === "carrot" ? 8 : 6).rim(RIM);

  if (kind === "turnip")
    return tuft(c, 7, 10, 6)
      .oval(8, 12, 4.5, 3.5, "#f6efe6")
      .box(4, 9, 8, 2, "#c77dba")
      .box(5, 9, 3, 1, "#dba3d1")
      .box(7, 15, 2, 1, "#f6efe6")
      .rim("#4a3340");

  if (kind === "carrot")
    return tuft(c, 7, 9, 8)
      .box(5, 9, 6, 3, "#f08a3c")
      .box(6, 12, 4, 2, "#f08a3c")
      .box(7, 14, 2, 2, "#e0762a")
      .box(5, 9, 2, 1, "#f6a65e")
      .dot(8, 11, "#d96f24")
      .dot(7, 13, "#d96f24")
      .rim("#4a3328");

  return c
    .oval(8, 11, 7.5, 5, "#f08a3c")
    .oval(8, 11, 4, 5, "#f6a04e")
    .box(7, 7, 2, 9, "#f08a3c")
    .box(1, 12, 2, 2, "#d96f24")
    .box(13, 12, 2, 2, "#d96f24")
    .box(5, 7, 2, 1, "#fbc07a")
    .box(7, 3, 2, 3, "#4f9a3a")
    .box(9, 3, 3, 1, LEAF)
    .rim("#4a3328");
};

/** A crop at one stage. It hops out of the soil once, then stands. */
export const Crop = ({
  kind,
  growth,
}: {
  readonly kind: CropKind;
  readonly growth: Growth;
}): SvgNode => (
  <Once>
    <g
      animation={motion({ y: PX * 2 })
        .to({ y: -PX }, span(0, 0.12), ease.steps(3))
        .to({ y: 0 }, span(0.12, 0.1), ease.steps(1))}
    >
      <Pixels of={drawn(kind, growth)} />
    </g>
  </Once>
);

/** A crop as it looks in the pack: ripe, in a 16 pixel square. */
export const CropIcon = ({ kind }: { readonly kind: CropKind }): SvgNode => (
  <Pixels of={drawn(kind, 3)} anchor={[1, 2]} />
);
