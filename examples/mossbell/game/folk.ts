import { random, type Point } from "svjeez";
import type { Gait, Look } from "../art/character";
import { createSprite, type Sprite } from "../play/sprite";
import type { Stage } from "../play/stage";
import { distance, walk, type Terrain } from "../play/walk";
import { chickenSheet, villagerSheet } from "./sheets";

/** Something with a sprite that can face a way and walk or stand. */
export interface Body {
  readonly sprite: Sprite;
  /** Stand or walk facing along `heading`. A zero heading keeps the last one. */
  pose(gait: Gait, heading: Point): void;
}

export const villagerBody = (look: Look): Body => {
  const sprite = createSprite(villagerSheet(look));
  let facing = "down";

  return {
    sprite,
    pose(gait, { x, y }) {
      if (x !== 0 || y !== 0) {
        facing = Math.abs(x) > Math.abs(y) ? "side" : y < 0 ? "up" : "down";

        if (facing === "side") sprite.mirror(x < 0);
      }

      sprite.show(`${gait}-${facing}`);
    },
  };
};

export const chickenBody = (): Body => {
  const sprite = createSprite(chickenSheet());

  return {
    sprite,
    pose(gait, { x }) {
      if (x !== 0) sprite.mirror(x < 0);
      sprite.show(gait);
    },
  };
};

/** Someone who ambles about near home: walks to a spot, rests, picks another. */
export interface Wanderer {
  readonly name: string;
  readonly body: Body;
  readonly lines: readonly string[];
  /** Stop where they stand and turn to a point, or carry on. */
  attend(to: Point | undefined): void;
  amble(dt: number): void;
}

export interface WandererOptions {
  readonly name: string;
  readonly body: Body;
  readonly home: Point;
  /** How far from home they stray, in px. */
  readonly reach: number;
  /** Px a second. */
  readonly speed: number;
  readonly lines: readonly string[];
}

export const createWanderer = (
  { name, body, home, reach, speed, lines }: WandererOptions,
  stage: Stage,
  terrain: Terrain,
): Wanderer => {
  const next = random(name);
  let at = home;
  let goal: Point | undefined;
  let rest = next() * 3;
  let attending: Point | undefined;

  stage.stand(body.sprite, at);
  body.pose("idle", { x: 0, y: 1 });

  return {
    name,
    body,
    lines,
    attend(to) {
      attending = to;

      if (to) body.pose("idle", { x: to.x - at.x, y: to.y - at.y });
    },
    amble(dt) {
      if (attending) return;

      if (!goal) {
        rest -= dt;

        if (rest > 0) return;
        const turn = next() * Math.PI * 2;
        const far = (0.3 + next() * 0.7) * reach;

        goal = { x: home.x + Math.cos(turn) * far, y: home.y + Math.sin(turn) * far * 0.7 };
      }

      const gap = distance(at, goal);
      const heading = { x: (goal.x - at.x) / gap, y: (goal.y - at.y) / gap };
      const moved = walk(at, { x: heading.x * speed * dt, y: heading.y * speed * dt }, terrain);

      if (gap < 3 || distance(moved, at) < speed * dt * 0.5) {
        goal = undefined;
        rest = 1 + next() * 4;
        body.pose("idle", { x: 0, y: 0 });

        return;
      }

      at = moved;
      body.pose("walk", heading);
      stage.stand(body.sprite, at);
    },
  };
};
