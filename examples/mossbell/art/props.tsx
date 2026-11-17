/** @jsxImportSource svjeez */
import {
  Clip,
  def,
  ease,
  motion,
  Pivot,
  random,
  span,
  type Color,
  type Ref,
  type SvgNode,
} from "svjeez";
import { outline } from "./character";
import { shade, type Hex } from "./color";
import { nightGlow } from "./daylight";
import { canvas, Flipbook, Pixels, PX, type Canvas } from "./pixel";

/**
 * Every prop is a canvas with a base: the pixel that stands on the ground. A prop that appears more than once is drawn
 * into a symbol, so the world holds one copy of its pixels however many trees there are.
 */

const INK: Hex = "#3b2a33";
const WOOD: Hex = "#8b5a3c";
const SHADE = "rgba(30,50,20,0.24)";

const stamped = (of: Canvas, anchor: readonly [number, number]): Ref<"symbol"> =>
  def.symbol({ style: "overflow:visible" }, <Pixels of={of} anchor={anchor} />);

const groundShadow = (wide: number): Ref<"symbol"> =>
  stamped(canvas(wide * 2 + 2, 8).oval(wide + 1, 4, wide, 3, SHADE), [wide + 1, 4]);

const SHADOWS = { wide: groundShadow(13), mid: groundShadow(8), small: groundShadow(5) } as const;

/** Flecks of a second color over one color, for leaves, stone and straw. */
const fleck = (of: Canvas, seed: string, on: Color, to: Color, chance: number): Canvas => {
  const next = random(seed);

  return of.tint((_x, _y, color) => (color === on && next() < chance ? to : undefined));
};

export type TreeKind = "oak" | "pine" | "blossom" | "apple";

const leafy = (leaf: Hex, seed: string, apples: boolean): Canvas => {
  const dark = shade(leaf, -0.3);
  const lit = shade(leaf, 0.2);
  const top = shade(leaf, 0.4);
  const c = canvas(36, 48).from(1, 1);

  c.box(15, 30, 4, 13, WOOD)
    .box(14, 41, 6, 2, WOOD)
    .box(18, 30, 1, 13, "#6b4329")
    .dot(16, 35, "#6b4329");
  c.oval(17, 20, 15, 12, dark).oval(8, 23, 7, 6, dark).oval(26, 23, 7, 6, dark);
  c.oval(17, 17, 14, 12, leaf).oval(8, 21, 6.5, 5.5, leaf).oval(26, 21, 6.5, 5.5, leaf);
  c.oval(13, 13, 9, 7, lit).oval(23, 17, 5, 4, lit).oval(11, 10, 5, 3.5, top);
  fleck(c, `${seed}-a`, leaf, dark, 0.07);
  fleck(c, `${seed}-b`, lit, top, 0.1);
  fleck(c, `${seed}-c`, dark, leaf, 0.08);

  if (apples)
    for (const [x, y] of [
      [8, 20],
      [14, 24],
      [22, 22],
      [26, 16],
      [17, 12],
      [10, 13],
    ] as const)
      c.box(x, y, 2, 2, "#e4572e").dot(x, y, "#ff8f6b");

  return c.rim(shade(leaf, -0.6));
};

const pine = (): Canvas => {
  const leaf: Hex = "#2f7d5b";
  const c = canvas(32, 54).from(1, 1);

  c.box(13, 42, 4, 9, WOOD).box(16, 42, 1, 9, "#6b4329");

  const tiers: readonly (readonly [top: number, bottom: number, reach: number])[] = [
    [24, 43, 14],
    [12, 30, 11],
    [1, 18, 8],
  ];

  for (const [top, bottom, reach] of tiers)
    for (let row = top; row <= bottom; row++) {
      const half = Math.max(1, Math.round(((row - top) / (bottom - top)) * reach));

      c.box(15 - half, row, half * 2, 1, row === bottom ? shade(leaf, -0.3) : leaf);
      c.box(15 - half, row, Math.ceil(half * 0.7), 1, row === bottom ? leaf : shade(leaf, 0.16));
    }

  return c.rim(shade(leaf, -0.6));
};

const TREES = {
  oak: [
    stamped(leafy("#4f9a4a", "oak-1", false), [18, 44]),
    stamped(leafy("#5aa552", "oak-2", false), [18, 44]),
  ],
  blossom: [stamped(leafy("#f2a7c3", "blossom", false), [18, 44])],
  apple: [stamped(leafy("#5fa84e", "apple", true), [18, 44])],
  pine: [stamped(pine(), [16, 52])],
} as const satisfies { readonly [K in TreeKind]: readonly Ref<"symbol">[] };

export const Tree = ({
  kind,
  pick,
}: {
  readonly kind: TreeKind;
  readonly pick: number;
}): SvgNode => (
  <>
    <use href={kind === "pine" ? SHADOWS.mid : SHADOWS.wide} />
    <use href={TREES[kind][Math.abs(Math.round(pick)) % TREES[kind].length]} />
  </>
);

const bush = (berries: boolean): Canvas => {
  const c = canvas(20, 16).from(1, 1);

  c.oval(9, 8, 8.5, 5.5, "#35783c").oval(9, 7, 8, 5, "#4f9a4a").oval(6, 5, 4, 2.5, "#74bd63");
  fleck(c, "bush", "#4f9a4a", "#35783c", 0.1);

  if (berries)
    for (const [x, y] of [
      [4, 8],
      [9, 6],
      [13, 9],
      [8, 10],
    ] as const)
      c.dot(x, y, "#d1495b");

  return c.rim("#1f3d25");
};

const BUSH = stamped(bush(false), [10, 14]);
const BERRIES = stamped(bush(true), [10, 14]);

export const Bush = ({ berries }: { readonly berries?: boolean }): SvgNode => (
  <>
    <use href={SHADOWS.mid} />
    <use href={berries ? BERRIES : BUSH} />
  </>
);

const ROCK = stamped(
  canvas(16, 12)
    .from(1, 1)
    .oval(7, 5, 6.5, 4.5, "#9aa3a8")
    .box(1, 5, 12, 4, "#9aa3a8")
    .box(1, 8, 12, 1, "#7d868c")
    .oval(5, 3, 3, 1.5, "#c3cacd")
    .rim(INK),
  [8, 11],
);

export const Rock = (): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <use href={ROCK} />
  </>
);

const STUMP = stamped(
  canvas(16, 13)
    .from(1, 1)
    .box(2, 4, 10, 7, "#7a4e33")
    .box(10, 4, 2, 7, "#5e3b25")
    .oval(7, 4, 5.5, 2.5, "#d9b382")
    .oval(7, 4, 2.5, 1, "#b98c5a")
    .rim(INK),
  [8, 12],
);

export const Stump = (): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <use href={STUMP} />
  </>
);

const sunflower = (): Canvas => {
  const c = canvas(17, 28).from(1, 1);

  c.box(7, 11, 1, 15, "#74bd63").box(8, 11, 1, 15, "#3f8a45");
  c.box(3, 16, 4, 2, "#57a654")
    .box(2, 17, 2, 1, "#57a654")
    .dot(4, 18, "#3f8a45")
    .box(4, 16, 2, 1, "#8fd66a");
  c.box(9, 20, 4, 2, "#57a654")
    .box(12, 19, 2, 1, "#57a654")
    .dot(11, 22, "#3f8a45")
    .box(10, 20, 2, 1, "#8fd66a");
  c.oval(7.5, 6, 6.6, 6.6, "#f2a516")
    .oval(7.5, 6, 5.6, 5.6, "#fbd13a")
    .oval(6.5, 4.5, 3.5, 2.5, "#fde27a");

  for (let i = 0; i < 8; i++) {
    const turn = ((i + 0.5) / 8) * Math.PI * 2;

    c.clear(Math.floor(7.5 + Math.cos(turn) * 6.2), Math.floor(6 + Math.sin(turn) * 6.2));
  }

  c.oval(7.5, 6, 3.9, 3.9, "#e8901a").oval(7.5, 6, 3, 3, "#6b4226");
  c.tint((x, y, color) => (color === "#6b4226" && (x + y) % 2 === 0 ? "#8a5a30" : undefined));

  return c.dot(6, 5, "#b07a3e").edge(outline);
};

const SUNFLOWER = stamped(sunflower(), [8, 27]);

export const Sunflower = (): SvgNode => <use href={SUNFLOWER} />;

const REEDS = stamped(
  canvas(10, 16)
    .from(1, 1)
    .box(1, 5, 1, 9, "#5f9a4a")
    .box(4, 3, 1, 11, "#5f9a4a")
    .box(6, 6, 1, 8, "#74b05a")
    .box(1, 2, 1, 3, "#7a4e33")
    .box(4, 0, 1, 3, "#7a4e33")
    .rim("#2f4a2a"),
  [5, 15],
);

export const Reeds = (): SvgNode => <use href={REEDS} />;

const FENCE_ACROSS = stamped(
  canvas(16, 11)
    .from(0, 1)
    .box(0, 2, 16, 2, "#c79a63")
    .box(0, 5, 16, 2, "#b58752")
    .box(0, 0, 2, 9, "#e0bd8a")
    .box(8, 0, 2, 9, "#e0bd8a")
    .rim("#5e3b25"),
  [0, 10],
);

const FENCE_DOWN = stamped(
  canvas(6, 28)
    .from(1, 1)
    .box(1, 0, 2, 17, "#b58752")
    .box(0, 16, 4, 10, "#e0bd8a")
    .box(3, 17, 1, 9, "#c79a63")
    .rim("#5e3b25"),
  [3, 27],
);

/** One square of fence running across, from its left end. */
export const FenceAcross = (): SvgNode => <use href={FENCE_ACROSS} />;

/** One square of fence running up from its base. */
export const FenceDown = (): SvgNode => <use href={FENCE_DOWN} />;

const ROOF: Hex = "#d9694a";
const WALL: Hex = "#f3e3c3";

const WINDOWS = [16, 64] as const;

const cottage = (): Canvas => {
  const c = canvas(92, 80).from(0, 1);

  c.box(66, 1, 8, 14, "#b0705a").box(65, 0, 10, 2, "#8f5645").box(72, 2, 2, 12, "#96604c");
  c.box(8, 46, 76, 32, WALL).box(8, 73, 76, 5, "#a8a29a").box(8, 75, 76, 1, "#8d877f");

  for (let x = 12; x < 84; x += 8)
    c.dot(x, 74, "#8d877f")
      .dot(x + 4, 76, "#8d877f")
      .dot(x + 4, 77, "#8d877f");

  for (const x of [8, 32, 58, 82]) c.box(x, 46, 2, 27, "#a8683f");

  for (let row = 8; row <= 47; row++) {
    const half = Math.round(30 + ((row - 8) / 39) * 14);
    const band = Math.floor((row - 8) / 6);
    const line = (row - 8) % 6 === 5;

    c.box(
      46 - half,
      row,
      half * 2,
      1,
      row < 10 ? "#e88163" : row > 44 ? "#a3432f" : line ? "#b8503a" : ROOF,
    );

    if (!line && row >= 10 && row <= 44)
      for (let x = 46 - half + 3 + (band % 2) * 4; x < 46 + half - 1; x += 8)
        c.dot(x, row, "#c25a40");
  }

  c.box(41, 56, 10, 22, WOOD).box(42, 57, 8, 21, "#a8683f").dot(41, 56, WALL).dot(50, 56, WALL);
  c.box(45, 58, 1, 20, "#96583a")
    .box(47, 58, 1, 20, "#96583a")
    .dot(48, 68, "#f6d55c")
    .box(39, 77, 14, 1, "#8d877f");

  for (const x of WINDOWS) {
    c.box(x, 54, 12, 12, WOOD)
      .box(x + 1, 55, 10, 10, "#9fd3e6")
      .box(x + 2, 56, 2, 1, "#d4eef6")
      .dot(x + 2, 57, "#d4eef6");
    c.box(x + 5, 55, 2, 10, WOOD)
      .box(x + 1, 60, 10, 1, WOOD)
      .box(x - 1, 66, 14, 3, "#a8683f");

    for (let i = 0; i < 6; i++)
      c.dot(x + i * 2, 65, i % 2 === 0 ? "#e88fb4" : "#f6d55c").dot(x + 1 + i * 2, 66, "#57a654");
  }

  return c.rim("#4a3328");
};

const lit = (of: Canvas, x: number, y: number, wide: number, tall: number): Canvas =>
  of.box(x, y, wide, tall, "#ffd97a").box(x + 1, y + 1, wide - 2, 1, "#fff0b8");

const cottageLit = (): Canvas => {
  const c = canvas(92, 80).from(0, 1);

  for (const x of WINDOWS) {
    lit(c, x + 1, 55, 4, 5);
    lit(c, x + 7, 55, 4, 5);
    lit(c, x + 1, 61, 4, 4);
    lit(c, x + 7, 61, 4, 4);
  }

  return c;
};

const puff = (r: number): Canvas =>
  canvas(12, 12)
    .oval(6, 6, r, r, "#f4efe6")
    .oval(5, 5, r * 0.5, r * 0.5, "#ffffff");

const Smoke = (): SvgNode => (
  <>
    {[0, 1, 2].map((i) => {
      const rise = span(0.05 + i * 1.3, 1.3);

      return (
        <g
          animation={motion({ y: 0, opacity: 0 })
            .set({ opacity: 0.85 }, rise.at)
            .to({ y: -16 * PX }, rise, ease.steps(8))
            .set({ opacity: 0 }, rise.end)
            .loop(4)}
        >
          <Pixels of={puff(2.4 + i * 0.8)} anchor={[6 - (i % 2), 6]} />
        </g>
      );
    })}
  </>
);

/** The cottage: 76 pixels of wall, the door in the middle, under a roof that overhangs both sides. */
export const Cottage = (): SvgNode => (
  <>
    <Pixels of={canvas(96, 10).oval(48, 5, 46, 4, SHADE)} anchor={[48, 4]} />
    <g transform={`translate(${24 * PX} ${-78 * PX})`}>
      <Smoke />
    </g>
    <Pixels of={cottage()} anchor={[46, 79]} />
    <g animation={nightGlow}>
      <Pixels of={cottageLit()} anchor={[46, 79]} />
    </g>
  </>
);

const mill = (): Canvas => {
  const c = canvas(46, 72).from(1, 1);

  c.oval(22, 19, 11, 10, "#b8503a").oval(19, 15, 5, 3, "#d9694a");

  for (let row = 18; row <= 67; row++) {
    const half = Math.round(9 + ((row - 18) / 49) * 6);

    c.box(22 - half, row, half * 2, 1, "#d8d2c4").box(22 + half - 5, row, 5, 1, "#c4bdae");
  }

  fleck(c, "mill", "#d8d2c4", "#b9b2a2", 0.05);
  c.box(18, 56, 8, 12, WOOD)
    .box(19, 57, 6, 11, "#a8683f")
    .dot(18, 56, "#d8d2c4")
    .dot(25, 56, "#d8d2c4");
  c.box(20, 36, 4, 6, "#5b6b8a").box(19, 42, 6, 1, "#a9a293");

  return c.rim("#4a3328");
};

const sails = (): Canvas => {
  const arm = canvas(60, 60)
    .box(29, 2, 2, 28, "#74482f")
    .box(31, 3, 9, 21, "#c9b78f")
    .box(32, 4, 7, 19, "#f6efdd");

  for (const y of [8, 13, 18]) arm.box(32, y, 7, 1, "#c9b78f");
  arm.box(35, 4, 1, 19, "#c9b78f");

  const quarter = arm.turned();
  const half = quarter.turned();

  return canvas(60, 60)
    .stamp(arm, 0, 0)
    .stamp(quarter, 0, 0)
    .stamp(half, 0, 0)
    .stamp(half.turned(), 0, 0)
    .box(28, 28, 4, 4, "#5e3b25");
};

/** A stone windmill. The sails turn a quarter turn every three seconds, in steps. */
export const Windmill = (): SvgNode => (
  <>
    <use href={SHADOWS.wide} />
    <Pixels of={mill()} anchor={[23, 69]} />
    <g animation={nightGlow}>
      <Pixels of={lit(canvas(46, 72).from(1, 1), 20, 36, 4, 6)} anchor={[23, 69]} />
    </g>
    <g transform={`translate(0 ${-52 * PX})`}>
      <Pivot
        origin={{ x: 0, y: 0 }}
        animation={motion({ rotate: 0 }).to({ rotate: 90 }, span(0, 3), ease.steps(6)).loop(3)}
      >
        <Pixels of={sails()} anchor={[30, 30]} />
      </Pivot>
    </g>
  </>
);

const well = (): Canvas => {
  const c = canvas(24, 30).from(1, 1);

  c.box(4, 6, 2, 11, WOOD)
    .box(16, 6, 2, 11, WOOD)
    .box(11, 6, 1, 6, "#74482f")
    .box(10, 11, 3, 3, "#a8683f");

  for (let row = 0; row <= 6; row++)
    c.box(11 - (2 + row * 1.5), row, 4 + row * 3, 1, row === 6 ? "#b8503a" : ROOF);
  c.box(3, 17, 16, 9, "#a9a293")
    .box(15, 17, 4, 9, "#8d877f")
    .dot(3, 25, "#8d877f")
    .oval(11, 17, 8, 3, "#c4bdae")
    .oval(11, 17, 6, 2, "#3d6f93");
  c.box(5, 21, 3, 1, "#8d877f").box(10, 23, 3, 1, "#8d877f").box(12, 20, 2, 1, "#8d877f");

  return c.rim(INK);
};

export const Well = (): SvgNode => (
  <>
    <use href={SHADOWS.mid} />
    <Pixels of={well()} anchor={[12, 28]} />
  </>
);

const LAMP = stamped(
  canvas(12, 30)
    .from(1, 1)
    .box(4, 9, 2, 17, "#4a4f5c")
    .box(3, 25, 4, 2, "#3a3f4a")
    .box(2, 3, 6, 6, "#dfe8ea")
    .box(1, 2, 8, 1, "#3a3f4a")
    .box(3, 0, 4, 2, "#3a3f4a")
    .box(1, 9, 8, 1, "#3a3f4a")
    .rim("#262a33"),
  [6, 29],
);

const LAMP_LIT = stamped(lit(canvas(12, 30).from(1, 1), 2, 3, 6, 6), [6, 29]);

export const Lamp = (): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <use href={LAMP} />
    <use href={LAMP_LIT} animation={nightGlow} />
  </>
);

const glow = (r: number): Ref<"symbol"> =>
  stamped(
    canvas(r * 2, r * 2)
      .oval(r, r, r, r, "rgba(255,217,122,0.13)")
      .oval(r, r, r * 0.66, r * 0.66, "rgba(255,221,135,0.24)")
      .oval(r, r, r * 0.33, r * 0.33, "rgba(255,230,160,0.38)"),
    [r, r],
  );

const GLOWS = new Map<number, Ref<"symbol">>();

/** Light that spills from a lamp or a window after dark, `r` pixels out, in three hard rings. */
export const Glow = ({ r }: { readonly r: number }): SvgNode => {
  const ring = GLOWS.get(r) ?? glow(r);

  GLOWS.set(r, ring);

  return <use href={ring} animation={nightGlow} />;
};

const BOARD = stamped(
  canvas(26, 20)
    .from(1, 1)
    .box(11, 9, 2, 9, WOOD)
    .box(0, 0, 24, 10, "#d9b382")
    .box(0, 9, 24, 1, "#c79a63")
    .rim("#5e3b25"),
  [13, 19],
);

export const Sign = ({ text }: { readonly text: string }): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <use href={BOARD} />
    <text
      x={0}
      y={-37}
      textAnchor="middle"
      fontSize={15}
      fill="#5b3a26"
      fontFamily="'Pixelify Sans', sans-serif"
      fontWeight="bold"
    >
      {text}
    </text>
  </>
);

const HAY = stamped(
  fleck(
    canvas(18, 15)
      .from(1, 1)
      .box(0, 1, 16, 12, "#e8c35a")
      .box(0, 1, 16, 3, "#f3d77e")
      .box(4, 1, 1, 12, "#b98c3a")
      .box(11, 1, 1, 12, "#b98c3a"),
    "hay",
    "#e8c35a",
    "#d4ad45",
    0.14,
  )
    .clear(1, 2)
    .clear(16, 2)
    .rim("#6b4a1e"),
  [9, 14],
);

export const HayBale = (): SvgNode => (
  <>
    <use href={SHADOWS.mid} />
    <use href={HAY} />
  </>
);

const scarecrow = (): Canvas => {
  const c = canvas(22, 32).from(1, 1);

  c.box(9, 14, 2, 15, WOOD)
    .box(1, 12, 18, 2, WOOD)
    .box(5, 11, 10, 9, "#4f86c6")
    .box(13, 11, 2, 9, "#3f6fa6");
  c.clear(6, 20).clear(9, 20).clear(13, 20).box(8, 14, 3, 3, "#e4572e").box(7, 4, 6, 7, "#f0d9a8");
  c.dot(8, 7, INK)
    .dot(11, 7, INK)
    .box(9, 9, 2, 1, "#8a4b3c")
    .box(3, 3, 14, 1, "#c9963f")
    .box(6, 0, 8, 3, "#e3b85a")
    .box(6, 2, 8, 1, "#d1495b");

  return c.rim(INK);
};

export const Scarecrow = (): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <Pixels of={scarecrow()} anchor={[11, 31]} />
  </>
);

const bin = (): Canvas => {
  const c = canvas(20, 17).from(1, 1);

  c.box(1, 6, 16, 9, "#a8683f")
    .box(1, 10, 16, 1, WOOD)
    .box(6, 6, 1, 9, WOOD)
    .box(11, 6, 1, 9, WOOD);
  c.box(0, 2, 18, 4, "#c79a63").box(0, 2, 18, 1, "#e0bd8a").box(8, 7, 2, 2, "#f6d55c");

  return c.rim(INK);
};

/** The crate the day's harvest is sold from. */
export const ShippingBin = (): SvgNode => (
  <>
    <use href={SHADOWS.mid} />
    <Pixels of={bin()} anchor={[10, 16]} />
  </>
);

const mailbox = (): Canvas => {
  const c = canvas(13, 18).from(1, 1);

  c.box(4, 7, 2, 9, WOOD)
    .box(1, 2, 8, 5, "#4f86c6")
    .box(1, 2, 8, 1, "#6fa0da")
    .clear(1, 2)
    .clear(8, 2);
  c.box(9, 0, 1, 5, "#d1495b").box(9, 0, 2, 2, "#d1495b");

  return c.rim(INK);
};

export const Mailbox = (): SvgNode => (
  <>
    <use href={SHADOWS.small} />
    <Pixels of={mailbox()} anchor={[6, 17]} />
  </>
);

const bench = (): Canvas => {
  const c = canvas(24, 13).from(1, 1);

  c.box(2, 6, 2, 5, "#74482f")
    .box(18, 6, 2, 5, "#74482f")
    .box(1, 0, 20, 2, "#c79a63")
    .box(1, 2, 20, 1, "#b58752");
  c.box(2, 3, 1, 2, "#74482f")
    .box(19, 3, 1, 2, "#74482f")
    .box(0, 5, 22, 2, "#d9b382")
    .box(0, 6, 22, 1, "#c79a63");

  return c.rim(INK);
};

export const Bench = (): SvgNode => (
  <>
    <use href={SHADOWS.mid} />
    <Pixels of={bench()} anchor={[12, 12]} />
  </>
);

const SPARK = [
  stamped(canvas(5, 5).dot(2, 2, "#ffffff"), [2, 2]),
  stamped(canvas(5, 5).box(2, 0, 1, 5, "#ffffff").box(0, 2, 5, 1, "#ffffff"), [2, 2]),
] as const;

/** A glint on water: a dot, a cross, a dot, then nothing for the rest of its period. */
export const Glint = ({
  at,
  period,
}: {
  readonly at: number;
  readonly period: number;
}): SvgNode => (
  <Clip at={at}>
    <Flipbook
      cells={[
        [<></>, period - 0.75],
        [<use href={SPARK[0]} />, 0.2],
        [<use href={SPARK[1]} />, 0.35],
        [<use href={SPARK[0]} />, 0.2],
      ]}
    />
  </Clip>
);
