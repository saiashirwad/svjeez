import type { Point } from "svjeez";
import { CROPS, type CropKind, type Growth } from "../art/crops";
import { TILE } from "../art/world";
import type { Sprite } from "../play/sprite";
import { createSprite } from "../play/sprite";
import type { Stage } from "../play/stage";
import { burst, cropSheet, floater, type Effect } from "./sheets";

interface Plot {
  readonly at: Point;
  crop?: {
    readonly kind: CropKind;
    growth: Growth;
    watered: boolean;
    left: number;
    sprite: Sprite;
  };
  readonly wet: SVGRectElement;
}

export interface Farm {
  /** What pressing the action key would do at a point, or nothing when it is not on soil or the crop is busy growing. */
  promptAt(at: Point, seed: CropKind): string | undefined;
  /** Do it: plant, water or harvest. Returns the crop pulled, when one was. */
  act(at: Point, seed: CropKind): CropKind | undefined;
  grow(dt: number): void;
}

const SVG = "http://www.w3.org/2000/svg";

const next = (growth: Growth): Growth => (growth === 0 ? 1 : growth === 1 ? 2 : 3);

export const createFarm = (stage: Stage, soil: readonly Point[]): Farm => {
  const plots: Plot[] = soil.map((at) => {
    const wet = document.createElementNS(SVG, "rect");

    wet.setAttribute("x", String(at.x + 3));
    wet.setAttribute("y", String(at.y + 3));
    wet.setAttribute("width", String(TILE - 6));
    wet.setAttribute("height", String(TILE - 6));
    wet.setAttribute("rx", "10");
    wet.setAttribute("fill", "#3b2416");
    wet.style.opacity = "0";
    wet.style.transition = "opacity 0.5s";
    stage.lay(wet);

    return { at, wet };
  });

  const plotAt = ({ x, y }: Point): Plot | undefined =>
    plots.find(({ at }) => x >= at.x && x < at.x + TILE && y >= at.y && y < at.y + TILE);

  const root = ({ at }: Plot): Point => ({ x: at.x + TILE / 2, y: at.y + TILE - 8 });

  const play = (effect: Effect, at: Point): void => stage.flash(effect.sheet, at, effect.seconds);

  const sprout = (plot: Plot, kind: CropKind, growth: Growth): Sprite => {
    const sprite = createSprite(cropSheet(kind, growth));

    plot.crop?.sprite.node.remove();
    stage.stand(sprite, root(plot));

    return sprite;
  };

  return {
    promptAt(at, seed) {
      const plot = plotAt(at);

      if (!plot) return undefined;

      if (!plot.crop) return `Plant ${CROPS[seed].name.toLowerCase()}`;

      if (plot.crop.growth === 3) return `Pull the ${CROPS[plot.crop.kind].name.toLowerCase()}`;

      return plot.crop.watered ? undefined : "Water";
    },
    act(at, seed) {
      const plot = plotAt(at);

      if (!plot) return undefined;
      const { crop } = plot;

      if (!crop) {
        plot.crop = {
          kind: seed,
          growth: 0,
          watered: false,
          left: 0,
          sprite: sprout(plot, seed, 0),
        };
        play(burst("#c9a871"), root(plot));

        return undefined;
      }

      if (crop.growth === 3) {
        crop.sprite.node.remove();
        plot.crop = undefined;
        play(burst("#f6d55c", true), root(plot));
        play(floater(`+1 ${CROPS[crop.kind].name.toLowerCase()}`), {
          x: root(plot).x,
          y: root(plot).y - 26,
        });

        return crop.kind;
      }

      if (!crop.watered) {
        crop.watered = true;
        crop.left = CROPS[crop.kind].seconds;
        plot.wet.style.opacity = "0.38";
        play(burst("#8fd0e2"), root(plot));
      }

      return undefined;
    },
    grow(dt) {
      for (const plot of plots) {
        const { crop } = plot;

        if (!crop?.watered) continue;
        crop.left -= dt;

        if (crop.left > 0) continue;
        crop.growth = next(crop.growth);
        crop.sprite = sprout(plot, crop.kind, crop.growth);
        crop.left = CROPS[crop.kind].seconds;

        if (crop.growth === 3) {
          crop.watered = false;
          plot.wet.style.opacity = "0";
        }
      }
    },
  };
};
