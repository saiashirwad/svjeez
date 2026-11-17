/** @jsxImportSource svjeez */
import type { Child } from "svjeez";
import {
  Character,
  CHARACTER,
  CHARACTER_LOOP,
  type Facing,
  type Gait,
  type Look,
} from "../art/character";
import { Chicken, CHICKEN } from "../art/chicken";
import type { Hex } from "../art/color";
import { Crop, CROP, CropIcon, type CropKind, type Growth } from "../art/crops";
import { Burst, BURST, FLOAT, Floater, Heart, HEART } from "../art/effects";
import { sheet, type Sheet } from "../play/sheet";

let made = 0;

/** A prefix no other sheet on the page has. */
const unique = (name: string): string => `${name}${made++}-`;

const GAITS: readonly Gait[] = ["idle", "walk"];
const FACINGS: readonly Facing[] = ["down", "up", "side"];

/** A villager's six states, named `idle-down`, `walk-side` and so on. */
export const villagerSheet = (look: Look): Sheet =>
  sheet(
    {
      prefix: unique("v"),
      width: CHARACTER.width,
      height: CHARACTER.height,
      anchor: CHARACTER.feet,
      duration: CHARACTER_LOOP,
    },
    GAITS.flatMap((gait) =>
      FACINGS.map(
        (facing) =>
          [`${gait}-${facing}`, <Character look={look} facing={facing} gait={gait} />] as const,
      ),
    ),
  );

export const chickenSheet = (): Sheet =>
  sheet(
    {
      prefix: unique("h"),
      width: CHICKEN.width,
      height: CHICKEN.height,
      anchor: CHICKEN.feet,
      duration: 6,
    },
    GAITS.map((gait) => [gait, <Chicken gait={gait} />] as const),
  );

export const cropSheet = (kind: CropKind, growth: Growth): Sheet =>
  sheet(
    { prefix: unique("c"), width: CROP.width, height: CROP.height, anchor: CROP.root, duration: 6 },
    [["crop", <Crop kind={kind} growth={growth} />]],
  );

export const cropIcon = (kind: CropKind): Sheet =>
  sheet({ prefix: unique("i"), width: 48, height: 48, anchor: { x: 24, y: 24 }, duration: 1 }, [
    ["icon", <CropIcon kind={kind} />],
  ]);

/** A sheet that plays once, and the seconds it runs. */
export interface Effect {
  readonly sheet: Sheet;
  readonly seconds: number;
}

const once = (seconds: number, picture: Child): Effect => ({
  seconds,
  sheet: sheet(
    {
      prefix: unique("e"),
      width: 2,
      height: 2,
      anchor: { x: 0, y: 0 },
      duration: seconds,
      loop: false,
    },
    [["effect", picture]],
  ),
});

export const burst = (color: Hex, star = false): Effect =>
  once(BURST, <Burst color={color} seed={`burst-${made}`} star={star} />);

export const floater = (text: string, color: Hex = "#5b3a26"): Effect =>
  once(FLOAT, <Floater text={text} color={color} />);

export const heart = (): Effect => once(HEART, <Heart />);
