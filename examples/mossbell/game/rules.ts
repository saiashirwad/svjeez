import {
  distance,
  game,
  roll,
  terrainOf,
  walk,
  within,
  type Effect,
  type Frame,
  type Game,
  type Next,
  type SpriteView,
  type Terrain,
} from "@svjeez/play";
import type { Point } from "svjeez";
import { DEFAULT_LOOK, randomLook, type Gait, type Look } from "../art/character";
import { CROPS, type CropKind, type Growth } from "../art/crops";
import { DAY, hourAt } from "../art/daylight";
import { TILE, type World } from "../art/world";
import { burst, cropSheet, floater, heart, henSheet, villagerSheet } from "./sheets";

export const KINDS: readonly CropKind[] = ["turnip", "carrot", "pumpkin"];

export interface Villager {
  readonly name: string;
  readonly look: Look;
}

export interface Pack {
  readonly coins: number;
  readonly crops: { readonly [K in CropKind]: number };
}

type Facing = "down" | "up" | "left" | "right";

/** Someone with a place to stand, a way they face, and a gait. */
interface Body {
  readonly at: Point;
  readonly facing: Facing;
  readonly gait: Gait;
}

/** Someone who ambles about near home: walks to a spot, rests, picks another. A hen has no look and nothing to say. */
interface Walker extends Body {
  readonly id: string;
  readonly name: string;
  readonly look?: Look;
  readonly lines: readonly string[];
  readonly home: Point;
  /** How far from home they stray, in px. */
  readonly reach: number;
  /** Px a second. */
  readonly speed: number;
  readonly goal?: Point;
  /** Seconds left to stand still. */
  readonly rest: number;
  /** Their own luck: where the next stroll goes. */
  readonly seed: number;
}

interface Crop {
  readonly kind: CropKind;
  readonly growth: Growth;
  readonly watered: boolean;
  /** Seconds until it grows again, once watered. */
  readonly left: number;
}

export interface Model {
  /** Seconds played. The day, the lamps and the clock all read it. */
  readonly time: number;
  readonly villager: Villager;
  /** The wardrobe is open: for the first time, before anyone has moved in, or again. */
  readonly dressing?: "first" | "again";
  readonly me: Body & { readonly goal?: Point };
  readonly seed: CropKind;
  readonly pack: Pack;
  /** What grows on each square of soil, in the order the world lists them. */
  readonly crops: readonly (Crop | undefined)[];
  readonly folk: readonly Walker[];
  /** Who is being talked to, and which of their lines is showing. */
  readonly talk?: { readonly who: string; readonly line: number };
  readonly toast?: { readonly text: string; readonly until: number };
}

export type Msg =
  | { readonly type: "seed"; readonly kind: CropKind }
  | { readonly type: "wardrobe" }
  | { readonly type: "dress"; readonly villager: Villager };

export type Action = "act" | "seed1" | "seed2" | "seed3";

/** What the page around the world shows. */
export interface Hud {
  readonly hour: number;
  readonly day: number;
  readonly pack: Pack;
  readonly seed: CropKind;
  readonly prompt?: string;
  readonly toast?: string;
  readonly talk?: { readonly name: string; readonly look: Look; readonly text: string };
  readonly wardrobe?: { readonly villager: Villager; readonly first: boolean };
}

export const SAVED = "mossbell.villager";

const SPEED = 118;
const REACH = 46;

const AHEAD = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
} as const satisfies { readonly [K in Facing]: Point };

const facingAlong = ({ x, y }: Point, before: Facing): Facing =>
  x === 0 && y === 0
    ? before
    : Math.abs(x) > Math.abs(y)
      ? x < 0
        ? "left"
        : "right"
      : y < 0
        ? "up"
        : "down";

const toward = (from: Point, to: Point): Point => {
  const gap = distance(from, to) || 1;

  return { x: (to.x - from.x) / gap, y: (to.y - from.y) / gap };
};

const neighbor = (id: string, home: Point, look: Look, lines: readonly string[]): Walker => ({
  id,
  name: id,
  look,
  lines,
  home,
  at: home,
  facing: "down",
  gait: "idle",
  reach: 80,
  speed: 38,
  rest: 1,
  seed: home.x * 31 + home.y,
});

const folk = ({ places }: World): Walker[] => [
  neighbor(
    "Juniper",
    { x: 801, y: 330 },
    { ...randomLook(lucky(11)), hat: "none", hair: "bun", outfit: "striped" },
    [
      "Morning! The well water is sweetest before the mill starts turning.",
      "Grow me a pumpkin and I will bake you something. Probably.",
      "That cottage stood empty for years. It is good to see smoke in the chimney again.",
    ],
  ),
  neighbor(
    "Bram",
    { x: 1461, y: 360 },
    { ...randomLook(lucky(23)), hat: "beanie", hair: "short", hairColor: "#f2ede4" },
    [
      "The sails go round once every twelve seconds. I counted. I have a lot of time.",
      "Wind is from the west today. Good for flour, bad for hats.",
    ],
  ),
  neighbor(
    "Pip",
    { x: 990, y: 792 },
    { ...randomLook(lucky(37)), hat: "straw", hair: "puffs", outfit: "overalls" },
    [
      "I saw a fish THIS big. No, you can not see it. It left.",
      "Lily pads are just chairs for frogs.",
      "If you stand on the dock at night the pond has stars in it.",
    ],
  ),
  ...["Dumpling", "Biscuit", "Clementine"].map((name, i): Walker => ({
    id: name,
    name,
    lines: [],
    home: { x: places.pen.x + i * 30, y: places.pen.y + i * 15 },
    at: { x: places.pen.x + i * 30, y: places.pen.y + i * 15 },
    facing: "right",
    gait: "idle",
    reach: 70,
    speed: 30,
    rest: i,
    seed: 101 + i,
  })),
];

/** A stream of numbers from 0 up to 1 for `randomLook`, from a seed. */
function lucky(seed: number): () => number {
  let state = seed;

  return () => {
    const [value, next] = roll(state);

    state = next;

    return value;
  };
}

const amble = (walker: Walker, dt: number, terrain: Terrain): Walker => {
  if (!walker.goal) {
    if (walker.rest > dt) return { ...walker, rest: walker.rest - dt, gait: "idle" };
    const [turn, afterTurn] = roll(walker.seed);
    const [far, seed] = roll(afterTurn);
    const by = (0.3 + far * 0.7) * walker.reach;

    return {
      ...walker,
      seed,
      goal: {
        x: walker.home.x + Math.cos(turn * Math.PI * 2) * by,
        y: walker.home.y + Math.sin(turn * Math.PI * 2) * by * 0.7,
      },
    };
  }

  const heading = toward(walker.at, walker.goal);
  const pace = walker.speed * dt;
  const moved = walk(walker.at, { x: heading.x * pace, y: heading.y * pace }, terrain);

  if (distance(walker.at, walker.goal) < 3 || distance(moved, walker.at) < pace * 0.5) {
    const [rest, seed] = roll(walker.seed);

    return { ...walker, seed, goal: undefined, rest: 1 + rest * 4, gait: "idle" };
  }

  return { ...walker, at: moved, gait: "walk", facing: facingAlong(heading, walker.facing) };
};

const grow = (crop: Crop | undefined, dt: number): Crop | undefined => {
  if (!crop?.watered) return crop;

  if (crop.left > dt) return { ...crop, left: crop.left - dt };
  const growth: Growth = crop.growth === 0 ? 1 : crop.growth === 1 ? 2 : 3;

  return { ...crop, growth, watered: growth < 3, left: CROPS[crop.kind].seconds };
};

const stroll = (model: Model, axis: Point, dt: number, terrain: Terrain): Model["me"] => {
  const { me } = model;
  const keys = axis.x !== 0 || axis.y !== 0;
  const goal = keys || !me.goal || distance(me.at, me.goal) < 4 ? undefined : me.goal;
  const way = keys ? axis : goal ? toward(me.at, goal) : axis;

  if (way.x === 0 && way.y === 0) return { ...me, goal, gait: "idle" };
  const at = walk(me.at, { x: way.x * SPEED * dt, y: way.y * SPEED * dt }, terrain);
  const stuck = distance(at, me.at) < SPEED * dt * 0.3;

  return { at, goal: stuck ? undefined : goal, gait: "walk", facing: facingAlong(way, me.facing) };
};

/** Something near enough to use: what the hint says, and what the action key makes of the model. */
interface Chance {
  readonly hint: string;
  take(model: Model): Model | Next<Model>;
}

const say = (model: Model, text: string): Model => ({
  ...model,
  toast: { text, until: model.time + 2.6 },
});

const rootOf = ({ x, y }: Point): Point => ({ x: x + TILE / 2, y: y + TILE - 9 });

const tend = (index: number, square: Point, model: Model): Chance | undefined => {
  const crop = model.crops[index];
  const root = rootOf(square);

  const set = (next: Crop | undefined): Model["crops"] =>
    model.crops.map((old, i) => (i === index ? next : old));

  if (!crop)
    return {
      hint: `Plant ${CROPS[model.seed].name.toLowerCase()}`,
      take: (now) => [
        { ...now, crops: set({ kind: now.seed, growth: 0, watered: false, left: 0 }) },
        [burst(root, "#c9a871")],
      ],
    };

  if (crop.growth === 3)
    return {
      hint: `Pull the ${CROPS[crop.kind].name.toLowerCase()}`,
      take: (now) => [
        {
          ...now,
          crops: set(undefined),
          pack: {
            ...now.pack,
            crops: { ...now.pack.crops, [crop.kind]: now.pack.crops[crop.kind] + 1 },
          },
        },
        [
          burst(root, "#f6d55c", true),
          floater({ x: root.x, y: root.y - 27 }, `+1 ${CROPS[crop.kind].name.toLowerCase()}`),
        ],
      ],
    };

  if (crop.watered) return undefined;

  return {
    hint: "Water",
    take: (now) => [
      { ...now, crops: set({ ...crop, watered: true, left: CROPS[crop.kind].seconds }) },
      [burst(root, "#8fd0e2")],
    ],
  };
};

const sell = (model: Model, bin: Point): Next<Model> => {
  const earned = KINDS.reduce((sum, kind) => sum + model.pack.crops[kind] * CROPS[kind].price, 0);
  const above = { x: bin.x, y: bin.y - 45 };

  return [
    {
      ...model,
      pack: { coins: model.pack.coins + earned, crops: { turnip: 0, carrot: 0, pumpkin: 0 } },
    },
    [burst(above, "#f6d55c", true), floater(above, `+${earned} coins`, "#b9770e")],
  ];
};

/** What the action key would do where the player stands and faces, or nothing. */
const chance = (model: Model, { soil, places }: World): Chance | undefined => {
  const { me } = model;
  const ahead = AHEAD[me.facing];
  const probe = { x: me.at.x + ahead.x * 14, y: me.at.y - 4 + ahead.y * 14 };
  const near = (to: Point, reach = REACH): boolean => distance(probe, to) < reach;
  const someone = model.folk.find((walker) => near(walker.at, walker.look ? REACH : 34));
  const plot = soil.findIndex((square) => within({ ...square, width: TILE, height: TILE }, probe));
  const square = soil[plot];
  const carried = KINDS.reduce((sum, kind) => sum + model.pack.crops[kind], 0);

  if (someone?.look)
    return {
      hint: `Talk to ${someone.name}`,
      take: (now) => [
        { ...now, talk: { who: someone.id, line: 0 } },
        [heart({ x: someone.at.x, y: someone.at.y - 96 })],
      ],
    };

  if (someone)
    return {
      hint: `Pet ${someone.name}`,
      take: (now) => [
        now,
        [
          heart({ x: someone.at.x, y: someone.at.y - 36 }),
          floater({ x: someone.at.x, y: someone.at.y - 48 }, "bawk!"),
        ],
      ],
    };

  if (square) return tend(plot, square, model);

  if (near(places.door))
    return { hint: "Open the wardrobe", take: (now) => ({ ...now, dressing: "again" }) };

  if (near(places.bin))
    return carried > 0
      ? {
          hint: `Sell ${carried} ${carried === 1 ? "crop" : "crops"}`,
          take: (now) => sell(now, places.bin),
        }
      : {
          hint: "Look in the shipping bin",
          take: (now) => say(now, "Empty. Whatever you pull from the plot sells here."),
        };

  if (near({ x: places.well.x, y: places.well.y + 10 }))
    return {
      hint: "Look down the well",
      take: (now) => say(now, "Cool, dark and very deep. Something glints at the bottom."),
    };

  if (near(places.mill))
    return {
      hint: "Knock on the mill",
      take: (now) => say(now, "Nobody answers. Bram must be out walking."),
    };

  return undefined;
};

const act = (model: Model, world: World): Model | Next<Model> => {
  const listener = model.folk.find(({ id }) => id === model.talk?.who);

  if (model.dressing) return model;

  if (!model.talk || !listener) return chance(model, world)?.take(model) ?? model;
  const line = model.talk.line + 1;

  return { ...model, talk: line < listener.lines.length ? { ...model.talk, line } : undefined };
};

const tick = (model: Model, dt: number, axis: Point, world: World): Model => {
  const terrain = terrainOf(world);
  const time = model.time + dt;
  const busy = model.dressing !== undefined || model.talk !== undefined;

  return {
    ...model,
    time,
    toast: model.toast && model.toast.until > time ? model.toast : undefined,
    crops: model.crops.map((crop) => grow(crop, dt)),
    folk: model.folk.map((walker) =>
      walker.id === model.talk?.who
        ? {
            ...walker,
            gait: "idle",
            goal: undefined,
            facing: facingAlong(toward(walker.at, model.me.at), walker.facing),
          }
        : amble(walker, dt, terrain),
    ),
    me: busy ? { ...model.me, goal: undefined, gait: "idle" } : stroll(model, axis, dt, terrain),
  };
};

const pose = ({ gait, facing }: Body): Pick<SpriteView, "state" | "mirror"> => ({
  state: `${gait}-${facing === "left" || facing === "right" ? "side" : facing}`,
  mirror: facing === "left",
});

const view = (model: Model, world: World): Frame<Hud> => {
  const { me, talk, time } = model;
  const listener = model.folk.find(({ id }) => id === talk?.who);
  const idle = !model.dressing && !talk;

  return {
    camera: model.dressing
      ? { x: 816 + Math.cos(time / 9) * 300, y: 520 + Math.sin(time / 7) * 150 }
      : me.at,
    time,
    sprites: [
      ...(model.dressing === "first"
        ? []
        : [{ key: "me", sheet: villagerSheet(model.villager.look), at: me.at, ...pose(me) }]),
      ...model.folk.map((walker): SpriteView =>
        walker.look
          ? { key: walker.id, sheet: villagerSheet(walker.look), at: walker.at, ...pose(walker) }
          : {
              key: walker.id,
              sheet: henSheet(),
              at: walker.at,
              state: walker.gait,
              mirror: walker.facing === "left",
            },
      ),
      ...model.crops.flatMap((crop, i): SpriteView[] => {
        const square = world.soil[i];

        return crop && square
          ? [
              {
                key: `crop-${i}-${crop.growth}`,
                sheet: cropSheet([crop.kind, crop.growth]),
                at: rootOf(square),
              },
            ]
          : [];
      }),
    ],
    patches: model.crops.flatMap((crop, i) => {
      const square = world.soil[i];

      return crop?.watered && square
        ? [
            {
              key: `wet-${i}`,
              area: { x: square.x + 3, y: square.y + 3, width: TILE - 6, height: TILE - 6 },
              fill: "#3b2416",
              opacity: 0.38,
            },
          ]
        : [];
    }),
    hud: {
      hour: hourAt(time),
      day: Math.floor(time / DAY) + 1,
      pack: model.pack,
      seed: model.seed,
      prompt: idle ? chance(model, world)?.hint : undefined,
      toast: model.toast?.text,
      talk:
        talk && listener
          ? {
              name: listener.name,
              look: listener.look ?? DEFAULT_LOOK,
              text: listener.lines[talk.line] ?? "",
            }
          : undefined,
      wardrobe: model.dressing
        ? { villager: model.villager, first: model.dressing === "first" }
        : undefined,
    },
  };
};

const SEEDS = { seed1: "turnip", seed2: "carrot", seed3: "pumpkin" } as const;

/**
 * Mossbell's rules. `saved` is the villager from the last visit, when there was one: the wardrobe opens on them
 * either way, since nobody has moved in until it closes.
 */
export const mossbell = (world: World, saved?: Villager): Game<Model, Msg, Hud, Action, World> =>
  game({
    world,
    keys: {
      act: ["KeyE", "Space", "Enter"],
      seed1: ["Digit1"],
      seed2: ["Digit2"],
      seed3: ["Digit3"],
    },
    init: (): Model => ({
      time: 0,
      villager: saved ?? { name: "", look: DEFAULT_LOOK },
      dressing: "first",
      me: { at: world.places.spawn, facing: "down", gait: "idle" },
      seed: "turnip",
      pack: { coins: 0, crops: { turnip: 0, carrot: 0, pumpkin: 0 } },
      crops: world.soil.map(() => undefined),
      folk: folk(world),
    }),
    update(model, msg): Model | Next<Model> {
      switch (msg.type) {
        case "tick":
          return tick(model, msg.dt, msg.axis, world);
        case "press":
          return msg.action === "act" ? act(model, world) : { ...model, seed: SEEDS[msg.action] };
        case "point":
          return model.dressing || model.talk
            ? model
            : { ...model, me: { ...model.me, goal: msg.at } };
        case "seed":
          return { ...model, seed: msg.kind };
        case "wardrobe":
          return { ...model, dressing: "again" };
        case "dress": {
          const stored: Effect = { type: "store", key: SAVED, value: JSON.stringify(msg.villager) };

          return [{ ...model, villager: msg.villager, dressing: undefined }, [stored]];
        }
      }
    },
    view,
  });
