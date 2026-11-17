/** @jsxImportSource svjeez */
import type { Color, SvgNode } from "svjeez";
import { isHex, mix, shade, type Hex } from "./color";
import { canvas, Flipbook, Pixels, PX, type Canvas, type Cells } from "./pixel";

export type HairStyle = "short" | "bob" | "long" | "puffs" | "spiky" | "bun";

export type Outfit = "tee" | "overalls" | "striped";

export type Hat = "none" | "straw" | "beanie";

/** Everything the wardrobe can change about a villager. */
export interface Look {
  readonly skin: Hex;
  readonly hair: HairStyle;
  readonly hairColor: Hex;
  readonly outfit: Outfit;
  readonly shirt: Hex;
  readonly pants: Hex;
  readonly hat: Hat;
  readonly accent: Hex;
}

export const OPTIONS = {
  skin: ["#fbe0c8", "#f3c9a5", "#e0a67c", "#c58656", "#9c6240", "#6f4530"],
  hair: ["short", "bob", "long", "puffs", "spiky", "bun"],
  hairColor: [
    "#3a2a26",
    "#6b4226",
    "#a8642c",
    "#e0b25a",
    "#d8573b",
    "#8d8fa8",
    "#f2ede4",
    "#5a7bd0",
    "#e58bb4",
    "#4f9a6a",
  ],
  outfit: ["tee", "overalls", "striped"],
  shirt: [
    "#e4572e",
    "#f2a541",
    "#f6d55c",
    "#76b041",
    "#3caea3",
    "#4f86c6",
    "#8e6bbf",
    "#e88fb4",
    "#f4efe6",
  ],
  pants: ["#3d5a80", "#5b4636", "#7a8f3c", "#444b5a", "#a65d57", "#c9a66b"],
  hat: ["none", "straw", "beanie"],
  accent: ["#d1495b", "#edae49", "#00798c", "#6a4c93", "#2f9e6e", "#f4efe6"],
} as const satisfies { readonly [K in keyof Look]: readonly Look[K][] };

export const DEFAULT_LOOK: Look = {
  skin: "#f3c9a5",
  hair: "bob",
  hairColor: "#6b4226",
  outfit: "overalls",
  shirt: "#f6d55c",
  pants: "#3d5a80",
  hat: "straw",
  accent: "#d1495b",
};

export type Facing = "down" | "up" | "side";

export type Gait = "idle" | "walk";

const GRID = { width: 26, height: 34, feet: [13, 31] } as const;

/** The box a character is drawn in, and the point between its feet. */
export const CHARACTER = {
  width: GRID.width * PX,
  height: GRID.height * PX,
  feet: { x: GRID.feet[0] * PX, y: GRID.feet[1] * PX },
} as const;

/** A scene length every character loop divides. */
export const CHARACTER_LOOP = 6;

/** Seconds each frame of the walk shows. */
const STEP = 0.15;

const EYE: Hex = "#33222e";
const SHOE: Hex = "#6b4630";
const GOLD: Hex = "#f6d55c";

/** The outline: each color's own shadow, pulled toward plum, so nothing is ringed in black. */
export const outline = (near: Color): Color =>
  isHex(near) ? mix(shade(near, -0.5), "#2b1d2e", 0.35) : "#2b1d2e";

/** How the body is held in one frame. Offsets are in pixels, and down is positive. */
interface Frame {
  /** The head, arms and torso, moved together. */
  readonly bob: number;
  /** How far each foot is off the ground, facing the viewer: left, then right. Sideways, the stride: -1, 0 or 1. */
  readonly feet: readonly [number, number];
  readonly blink?: boolean;
}

/** A head: 14 pixels across from the front, 13 from the side, with the corners taken off twice. */
const head = (c: Canvas, look: Look, x: number, wide: number): Canvas =>
  c
    .box(x + 2, 3, wide - 4, 1, look.skin)
    .box(x + 1, 4, wide - 2, 1, look.skin)
    .box(x, 5, wide, 8, look.skin)
    .box(x + 1, 13, wide - 2, 1, look.skin)
    .box(x + 2, 14, wide - 4, 1, look.skin);

const eye = (c: Canvas, look: Look, x: number, blink: boolean | undefined): Canvas =>
  blink
    ? c.box(x, 11, 2, 1, shade(look.skin, -0.3))
    : c
        .box(x, 9, 2, 3, EYE)
        .dot(x, 9, "#ffffff")
        .dot(x + 1, 11, "#75526a");

const hair = (c: Canvas, look: Look, facing: Facing): void => {
  const ink = look.hairColor;
  const side = facing === "side";
  const back = facing === "up";
  const style = look.hair;

  if (back)
    c.box(6, 1, 8, 1, ink).box(4, 2, 12, 1, ink).box(3, 3, 14, 10, ink).box(4, 13, 12, 1, ink);
  else if (side)
    c.box(6, 1, 8, 1, ink)
      .box(5, 2, 11, 1, ink)
      .box(4, 3, 13, 4, ink)
      .box(4, 7, 9, 1, ink)
      .dot(16, 7, ink)
      .box(4, 8, 6, 1, ink)
      .box(4, 9, 5, 4, ink)
      .box(5, 13, 3, 1, ink);
  else
    c.box(6, 1, 8, 1, ink)
      .box(4, 2, 12, 1, ink)
      .box(3, 3, 14, 4, ink)
      .box(3, 7, 8, 1, ink)
      .box(14, 7, 3, 1, ink)
      .box(3, 8, 4, 1, ink)
      .box(15, 8, 2, 1, ink)
      .box(3, 9, 1, 2, ink)
      .box(16, 9, 1, 2, ink);

  if (style === "bob" || style === "long") {
    const to = style === "long" ? 22 : 16;

    if (side) c.box(3, 7, 5, to - 7, ink).box(8, 7, 1, 9, ink);
    else c.box(2, 6, 2, to - 6, ink).box(16, 6, 2, to - 6, ink);

    if (back) c.box(4, 13, 12, to - 13, ink);
  }

  if (style === "puffs") {
    c.oval(side ? 3 : 1.5, 4, 3.2, 3.2, ink);

    if (!side) c.oval(18.5, 4, 3.2, 3.2, ink);
  }

  if (style === "spiky")
    for (const x of side ? [6, 9, 12, 15] : [5, 8, 11, 14])
      c.box(x - 1, 0, 3, 2, ink).dot(x, -1, ink);

  if (style === "bun") c.oval(side ? 3.5 : 10, side ? 5 : 0, 2.8, 2.6, ink);
};

/** Light on the crown and shadow under every lock, worked out from the shape that was drawn. */
const shadeHair = (c: Canvas, look: Look): void => {
  const ink = look.hairColor;
  const lit = shade(ink, 0.22);
  const dark = shade(ink, -0.22);
  const skinShade = shade(look.skin, -0.12);

  c.tint((x, y, color) => {
    if (color === look.skin && c.at(x, y - 1) === ink) return skinShade;

    if (color !== ink) return undefined;

    if (c.at(x, y + 1) !== ink) return dark;

    return y >= 3 && y <= 4 && x >= 6 && x <= 11 - (y - 3) * 3 ? lit : undefined;
  });
};

const hat = (c: Canvas, look: Look): void => {
  const trim = look.accent;

  if (look.hat === "straw")
    c.box(6, -1, 8, 1, "#f5dc94")
      .box(5, 0, 10, 4, "#f5dc94")
      .box(13, 0, 2, 3, "#e9c877")
      .box(6, 0, 3, 1, "#fdf0c0")
      .box(5, 3, 10, 1, trim)
      .box(13, 3, 2, 1, shade(trim, -0.2))
      .box(1, 4, 18, 1, "#f7e2a0")
      .box(0, 5, 20, 1, "#f0cf7a")
      .box(1, 6, 18, 1, "#d9a94e");

  if (look.hat === "beanie") {
    c.box(7, 0, 6, 1, trim).box(5, 1, 10, 1, trim).box(4, 2, 12, 1, trim).box(3, 3, 14, 2, trim);
    c.box(6, 2, 3, 1, shade(trim, 0.25))
      .box(14, 2, 2, 3, shade(trim, -0.15))
      .box(3, 5, 14, 2, shade(trim, 0.2));

    for (let x = 4; x < 17; x += 2) c.box(x, 5, 1, 2, shade(trim, -0.05));
    c.oval(10, -0.5, 2.2, 1.7, shade(trim, 0.5));
  }
};

const shirt = (c: Canvas, look: Look, x: number, wide: number): void => {
  c.box(x, 16, wide, 7, look.shirt).box(x + wide - 1, 17, 1, 6, shade(look.shirt, -0.14));

  if (look.outfit === "striped")
    for (const y of [17, 19, 21]) c.box(x, y, wide, 1, shade(look.shirt, 0.5));

  if (look.outfit === "overalls") c.box(x, 21, wide, 2, look.pants);
};

const facingViewer = (c: Canvas, look: Look, back: boolean, { bob, feet, blink }: Frame): void => {
  const [left, right] = feet;
  const cloth = look.shirt;
  const sleeve = shade(cloth, -0.14);
  const skinShade = shade(look.skin, -0.12);
  const leg = shade(look.pants, -0.16);
  const up = c.from(0, bob);

  c.box(6, 22, 8, 2, look.pants)
    .box(6, 24, 3, 3 - left, look.pants)
    .box(8, 24, 1, 3 - left, leg)
    .box(11, 24, 3, 3 - right, look.pants)
    .box(11, 24, 1, 3 - right, leg)
    .box(5, 27 - left, 4, 2, SHOE)
    .box(5, 27 - left, 2, 1, shade(SHOE, 0.25))
    .box(11, 27 - right, 4, 2, SHOE)
    .box(13, 27 - right, 2, 1, shade(SHOE, 0.25));

  up.box(4, 16 + right, 2, 6, cloth)
    .box(4, 16 + right, 1, 6, sleeve)
    .box(4, 22 + right, 2, 2, look.skin)
    .box(14, 16 + left, 2, 6, cloth)
    .box(15, 16 + left, 1, 6, sleeve)
    .box(14, 22 + left, 2, 2, look.skin)
    .box(8, 15, 4, 1, skinShade);
  shirt(up, look, 6, 8);

  if (look.outfit === "overalls") {
    if (back) {
      for (const [x, y] of [
        [7, 16],
        [8, 17],
        [9, 18],
        [10, 18],
        [11, 17],
        [12, 16],
      ] as const)
        up.box(x, y, 1, 2, look.pants);
      up.box(6, 20, 8, 1, look.pants);
    } else
      up.box(7, 16, 1, 2, look.pants)
        .box(12, 16, 1, 2, look.pants)
        .box(7, 18, 6, 3, look.pants)
        .dot(7, 18, GOLD)
        .dot(12, 18, GOLD)
        .box(9, 19, 2, 1, leg);
  } else if (!back) up.box(9, 16, 2, 1, look.skin);

  head(up, look, 3, 14).box(2, 9, 1, 3, skinShade).box(17, 9, 1, 3, skinShade);

  if (!back) {
    const blush = mix(look.skin, "#f2787a", 0.5);

    eye(up, look, 6, blink);
    eye(up, look, 12, blink);
    up.box(4, 12, 2, 1, blush)
      .box(14, 12, 2, 1, blush)
      .box(9, 13, 2, 1, mix(look.skin, "#a8323a", 0.6));
  }

  hair(up, look, back ? "up" : "down");
  shadeHair(up, look);
  hat(up, look);
};

const sideways = (c: Canvas, look: Look, { bob, feet, blink }: Frame): void => {
  const [stride] = feet;
  const up = c.from(0, bob);
  const skinShade = shade(look.skin, -0.12);
  const far = shade(look.pants, -0.24);
  const forward = stride >= 0;

  c.box(7, 22, 6, 2, look.pants);

  if (stride === 0)
    c.box(8, 24, 4, 3, look.pants).box(8, 27, 5, 2, SHOE).box(11, 27, 2, 1, shade(SHOE, 0.25));
  else
    c.box(6, 24, 3, 2, forward ? far : look.pants)
      .box(4, 26, 4, 2, forward ? shade(SHOE, -0.25) : SHOE)
      .box(10, 24, 3, 3, forward ? look.pants : far)
      .box(11, 27, 5, 2, forward ? SHOE : shade(SHOE, -0.25))
      .box(14, 27, 2, 1, forward ? shade(SHOE, 0.25) : SHOE);

  up.box(9, 15, 3, 1, skinShade);
  shirt(up, look, 7, 6);
  up.box(7, 17, 1, 6, shade(look.shirt, -0.14));

  if (look.outfit === "overalls")
    up.box(9, 18, 4, 3, look.pants).box(10, 16, 1, 2, look.pants).dot(10, 18, GOLD);

  up.box(9 - stride, 16, 2, 6, shade(look.shirt, -0.1))
    .box(9 - stride, 16, 1, 6, shade(look.shirt, -0.22))
    .box(9 - stride * 2, 22, 2, 2, look.skin);

  head(up, look, 4, 13).dot(17, 11, look.skin);
  eye(up, look, 13, blink);
  up.box(13, 12, 2, 1, mix(look.skin, "#f2787a", 0.5)).dot(15, 13, mix(look.skin, "#a8323a", 0.6));
  hair(up, look, "side");
  shadeHair(up, look);
  up.box(9, 10, 1, 2, skinShade);
  hat(up, look);
};

const shadow = canvas(GRID.width, GRID.height).oval(13, 31, 7, 1.8, "rgba(40,40,20,0.22)");

const frame = (look: Look, facing: Facing, pose: Frame): SvgNode => {
  const c = canvas(GRID.width, GRID.height);
  const body = c.from(3, 2);

  if (facing === "side") sideways(body, look, pose);
  else facingViewer(body, look, facing === "up", pose);

  return <Pixels of={c.edge(outline)} />;
};

const STAND: Frame = { bob: 0, feet: [0, 0] };

const WALK = {
  down: [STAND, { bob: -1, feet: [2, 0] }, STAND, { bob: -1, feet: [0, 2] }],
  up: [STAND, { bob: -1, feet: [2, 0] }, STAND, { bob: -1, feet: [0, 2] }],
  side: [
    { bob: -1, feet: [0, 0] },
    { bob: 0, feet: [1, 0] },
    { bob: -1, feet: [0, 0] },
    { bob: 0, feet: [-1, 0] },
  ],
} as const satisfies { readonly [K in Facing]: readonly Frame[] };

export interface CharacterProps {
  readonly look: Look;
  readonly facing: Facing;
  readonly gait: Gait;
}

/** A villager in one pose, drawn in the {@link CHARACTER} box and facing right when sideways. Every pose loops. */
export const Character = ({ look, facing, gait }: CharacterProps): SvgNode => {
  const cells: Cells =
    gait === "walk"
      ? WALK[facing].map((pose) => [frame(look, facing, pose), STEP] as const)
      : [
          [frame(look, facing, STAND), 1.35],
          [frame(look, facing, { ...STAND, bob: 1 }), 1.35],
          [frame(look, facing, { ...STAND, blink: true }), 0.15],
          [frame(look, facing, STAND), 0.15],
        ];

  return (
    <>
      <Pixels of={shadow} />
      <Flipbook cells={cells} />
    </>
  );
};

/** A look picked from the wardrobe by a seeded stream of numbers from 0 up to 1. */
export const randomLook = (next: () => number): Look => {
  const pick = <T,>(from: readonly T[]): T => {
    const found = from[Math.floor(next() * from.length)];

    if (found === undefined) throw new Error("randomLook() needs a stream of numbers below 1.");

    return found;
  };

  return {
    skin: pick(OPTIONS.skin),
    hair: pick(OPTIONS.hair),
    hairColor: pick(OPTIONS.hairColor),
    outfit: pick(OPTIONS.outfit),
    shirt: pick(OPTIONS.shirt),
    pants: pick(OPTIONS.pants),
    hat: pick(OPTIONS.hat),
    accent: pick(OPTIONS.accent),
  };
};
