import { random, type Point } from "svjeez";
import { DEFAULT_LOOK, randomLook, type Look } from "../art/character";
import { CROPS, type CropKind } from "../art/crops";
import { DAY, hourAt } from "../art/daylight";
import { buildWorld } from "../art/world";
import { createInput } from "../play/input";
import { everyFrame } from "../play/loop";
import { createStage } from "../play/stage";
import { distance, walk, type Terrain } from "../play/walk";
import { createFarm } from "./farm";
import { chickenBody, createWanderer, villagerBody, type Body, type Wanderer } from "./folk";
import { createHud, KINDS, type Pack } from "./hud";
import { burst, floater, heart } from "./sheets";
import "./style.css";
import { openWardrobe, type Villager } from "./wardrobe";

const SAVED = "mossbell.villager";
const SPEED = 118;
const REACH = 46;

const host = document.querySelector<HTMLElement>("#game");

if (!host) throw new Error("The page has no #game element.");

const saved = (): Villager => {
  try {
    const { name, look }: Partial<Villager> = JSON.parse(localStorage.getItem(SAVED) ?? "{}");

    return { name: name ?? "", look: { ...DEFAULT_LOOK, ...look } };
  } catch {
    return { name: "", look: DEFAULT_LOOK };
  }
};

const world = buildWorld();
const stage = createStage(host, world, { width: 860, height: 540 });
const input = createInput();

const terrain: Terrain = {
  bounds: { x: 0, y: 0, width: world.width, height: world.height },
  solids: world.solids,
};

const farm = createFarm(stage, world.soil);

let villager = saved();
let me: Body | undefined;
let at = world.places.spawn;
let heading: Point = { x: 0, y: 1 };
let goal: Point | undefined;
let seed: CropKind = "turnip";
let pack: Pack = { coins: 0, crops: { turnip: 0, carrot: 0, pumpkin: 0 } };
let dressing = true;
let listener: Wanderer | undefined;

const looks = new Map<Wanderer, Look>();

const neighbor = (name: string, home: Point, look: Look, lines: readonly string[]): Wanderer => {
  const who = createWanderer(
    { name, body: villagerBody(look), home, reach: 80, speed: 38, lines },
    stage,
    terrain,
  );

  looks.set(who, look);

  return who;
};

const folk: readonly Wanderer[] = [
  neighbor(
    "Juniper",
    { x: 800, y: 330 },
    { ...randomLook(random("juniper")), hat: "none", hair: "bun", outfit: "striped" },
    [
      "Morning! The well water is sweetest before the mill starts turning.",
      "Grow me a pumpkin and I will bake you something. Probably.",
      "That cottage stood empty for years. It is good to see smoke in the chimney again.",
    ],
  ),
  neighbor(
    "Bram",
    { x: 1460, y: 360 },
    { ...randomLook(random("bram")), hat: "beanie", hair: "short", hairColor: "#f2ede4" },
    [
      "The sails go round once every twelve seconds. I counted. I have a lot of time.",
      "Wind is from the west today. Good for flour, bad for hats.",
    ],
  ),
  neighbor(
    "Pip",
    { x: 990, y: 790 },
    { ...randomLook(random("pip")), hat: "straw", hair: "puffs", outfit: "overalls" },
    [
      "I saw a fish THIS big. No, you can not see it. It left.",
      "Lily pads are just chairs for frogs.",
      "If you stand on the dock at night the pond has stars in it.",
    ],
  ),
];

const hens: readonly Wanderer[] = ["Dumpling", "Biscuit", "Clementine"].map((name, i) =>
  createWanderer(
    {
      name,
      body: chickenBody(),
      home: { x: world.places.pen.x + i * 30, y: world.places.pen.y + i * 14 },
      reach: 70,
      speed: 30,
      lines: [],
    },
    stage,
    terrain,
  ),
);

const dress = (next: Villager): void => {
  villager = next;
  localStorage.setItem(SAVED, JSON.stringify(next));
  me?.sprite.node.remove();
  me = villagerBody(next.look);
  me.pose("idle", heading);
  stage.stand(me.sprite, at);
  dressing = false;
  hud.show(true);
  input.release();
};

const wardrobe = (first: boolean): void => {
  dressing = true;
  goal = undefined;
  hud.show(false);
  openWardrobe(host, villager, first, dress);
};

const hud = createHud(host, {
  pickSeed(kind) {
    seed = kind;
    hud.seed(kind);
  },
  openWardrobe: () => wardrobe(false),
});

/** Something near enough to use: what the hint says, and what the action key does. */
interface Chance {
  readonly hint: string;
  readonly take: () => void;
}

const sell = (): void => {
  const earned = KINDS.reduce((sum, kind) => sum + pack.crops[kind] * CROPS[kind].price, 0);
  const above = { x: world.places.bin.x, y: world.places.bin.y - 44 };

  pack = { coins: pack.coins + earned, crops: { turnip: 0, carrot: 0, pumpkin: 0 } };
  hud.pack(pack);
  stage.flash(burst("#f6d55c", true).sheet, above, 0.7);
  stage.flash(floater(`+${earned} coins`, "#b9770e").sheet, above, 1.1);
};

const chanceAt = (probe: Point): Chance | undefined => {
  const near = (to: Point, within = REACH): boolean => distance(probe, to) < within;
  const talker = folk.find(({ body }) => near(body.sprite.at));
  const hen = hens.find(({ body }) => near(body.sprite.at, 34));
  const carried = KINDS.reduce((sum, kind) => sum + pack.crops[kind], 0);
  const sow = farm.promptAt(probe, seed);

  if (talker)
    return {
      hint: `Talk to ${talker.name}`,
      take() {
        listener = talker;
        talker.attend(at);
        hud.say(talker.name, looks.get(talker) ?? DEFAULT_LOOK, talker.lines);
        stage.flash(
          heart().sheet,
          { x: talker.body.sprite.at.x, y: talker.body.sprite.at.y - 84 },
          1.2,
        );
      },
    };

  if (hen)
    return {
      hint: `Pet ${hen.name}`,
      take() {
        const above = { x: hen.body.sprite.at.x, y: hen.body.sprite.at.y - 36 };

        stage.flash(heart().sheet, above, 1.2);
        stage.flash(floater("bawk!").sheet, { x: above.x, y: above.y - 10 }, 1.1);
      },
    };

  if (sow)
    return {
      hint: sow,
      take() {
        const pulled = farm.act(probe, seed);

        if (!pulled) return;
        pack = { ...pack, crops: { ...pack.crops, [pulled]: pack.crops[pulled] + 1 } };
        hud.pack(pack);
      },
    };

  if (near(world.places.door)) return { hint: "Open the wardrobe", take: () => wardrobe(false) };

  if (near(world.places.bin))
    return carried > 0
      ? { hint: `Sell ${carried} ${carried === 1 ? "crop" : "crops"}`, take: sell }
      : {
          hint: "Look in the shipping bin",
          take: () => hud.toast("Empty. Whatever you pull from the plot sells here."),
        };

  if (near({ x: world.places.well.x, y: world.places.well.y + 10 }))
    return {
      hint: "Look down the well",
      take: () => hud.toast("Cool, dark and very deep. Something glints at the bottom."),
    };

  if (near(world.places.mill))
    return {
      hint: "Knock on the mill",
      take: () => hud.toast("Nobody answers. Bram must be out walking."),
    };

  return undefined;
};

host.addEventListener("pointerdown", (event) => {
  const onWorld = event.target instanceof Node && stage.root.contains(event.target);

  if (onWorld && !dressing && !hud.talking()) goal = stage.pointAt(event.clientX, event.clientY);
});

const steer = (): Point => {
  const keys = input.axis();

  if (keys.x !== 0 || keys.y !== 0) {
    goal = undefined;

    return keys;
  }

  if (!goal) return keys;
  const gap = distance(at, goal);

  if (gap < 4) {
    goal = undefined;

    return keys;
  }

  return { x: (goal.x - at.x) / gap, y: (goal.y - at.y) / gap };
};

hud.pack(pack);

hud.seed(seed);

hud.show(false);

wardrobe(true);

everyFrame((dt) => {
  const now = stage.clock();

  farm.grow(dt);

  for (const walker of [...folk, ...hens]) walker.amble(dt);
  hud.clock(hourAt(now), Math.floor(now / DAY) + 1);

  if (dressing || !me) {
    stage.follow({ x: 816 + Math.cos(now / 9) * 300, y: 520 + Math.sin(now / 7) * 150 }, dt);

    return;
  }

  const act = input.took("KeyE") || input.took("Space") || input.took("Enter");

  if (hud.talking()) {
    if (act) hud.advance();

    if (!hud.talking()) {
      listener?.attend(undefined);
      listener = undefined;
    }

    me.pose("idle", { x: 0, y: 0 });
    hud.prompt(undefined);
    stage.follow(at, dt);

    return;
  }

  for (const [index, kind] of KINDS.entries())
    if (input.took(`Digit${index + 1}`)) {
      seed = kind;
      hud.seed(kind);
    }

  const way = steer();
  const moving = way.x !== 0 || way.y !== 0;
  const moved = moving ? walk(at, { x: way.x * SPEED * dt, y: way.y * SPEED * dt }, terrain) : at;

  if (moving) heading = way;

  if (goal && distance(moved, at) < SPEED * dt * 0.3) goal = undefined;
  at = moved;
  me.pose(moving ? "walk" : "idle", way);
  stage.stand(me.sprite, at);
  stage.follow(at, dt);

  const chance = chanceAt({ x: at.x + heading.x * 14, y: at.y - 4 + heading.y * 14 });

  hud.prompt(chance?.hint);

  if (act) chance?.take();
});
