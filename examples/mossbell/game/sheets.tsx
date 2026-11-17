/** @jsxImportSource svjeez */
import { memo, sheet, type Effect, type Sheet } from "@svjeez/play";
import type { Child, Point } from "svjeez";
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
import { PX } from "../art/pixel";

const GAITS: readonly Gait[] = ["idle", "walk"];
const FACINGS: readonly Facing[] = ["down", "up", "side"];

/** A villager's six states, named `idle-down`, `walk-side` and so on. One sheet for each look, however often it is asked for. */
export const villagerSheet = memo(
  (look: Look): Sheet =>
    sheet(
      {
        width: CHARACTER.width,
        height: CHARACTER.height,
        anchor: CHARACTER.feet,
        duration: CHARACTER_LOOP,
        grid: PX,
      },
      GAITS.flatMap((gait) =>
        FACINGS.map(
          (facing) =>
            [`${gait}-${facing}`, <Character look={look} facing={facing} gait={gait} />] as const,
        ),
      ),
    ),
  (look) => JSON.stringify(look),
);

let hen: Sheet | undefined;

/** A hen's two states, `idle` and `walk`. */
export const henSheet = (): Sheet =>
  (hen ??= sheet(
    { width: CHICKEN.width, height: CHICKEN.height, anchor: CHICKEN.feet, duration: 6, grid: PX },
    GAITS.map((gait) => [gait, <Chicken gait={gait} />] as const),
  ));

export const cropSheet = memo(
  ([kind, growth]: readonly [CropKind, Growth]): Sheet =>
    sheet({ width: CROP.width, height: CROP.height, anchor: CROP.root, duration: 6, grid: PX }, [
      ["crop", <Crop kind={kind} growth={growth} />],
    ]),
  ([kind, growth]) => `${kind}-${growth}`,
);

export const cropIcon = memo(
  (kind: CropKind): Sheet =>
    sheet({ width: 48, height: 48, anchor: { x: 24, y: 24 }, duration: 1 }, [
      ["icon", <CropIcon kind={kind} />],
    ]),
  (kind) => kind,
);

/** A sheet that plays once, and the seconds it runs. */
interface Once {
  readonly sheet: Sheet;
  readonly seconds: number;
}

const once = (seconds: number, picture: Child): Once => ({
  seconds,
  sheet: sheet(
    { width: 2, height: 2, anchor: { x: 0, y: 0 }, duration: seconds, loop: false, grid: PX },
    [["effect", picture]],
  ),
});

const bursts = memo(
  ([color, star]: readonly [Hex, boolean]) =>
    once(BURST, <Burst color={color} seed={color} star={star} />),
  ([color, star]) => `${color}-${star}`,
);

const floaters = memo(
  ([text, color]: readonly [string, Hex]) => once(FLOAT, <Floater text={text} color={color} />),
  ([text, color]) => `${text}-${color}`,
);

let hearts: Once | undefined;

const flash = ({ sheet: played, seconds }: Once, at: Point): Effect => ({
  type: "flash",
  sheet: played,
  at,
  seconds,
});

/** Bits flung out from a point: dust, water or, as stars, sparks. */
export const burst = (at: Point, color: Hex, star = false): Effect =>
  flash(bursts([color, star]), at);

/** A word that rises from a point and goes. */
export const floater = (at: Point, text: string, color: Hex = "#5b3a26"): Effect =>
  flash(floaters([text, color]), at);

export const heart = (at: Point): Effect => flash((hearts ??= once(HEART, <Heart />)), at);
