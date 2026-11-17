import { expect, test } from "bun:test";
import { run, ticks, within } from "@svjeez/play";
import { DEFAULT_LOOK } from "../mossbell/art/character";
import { buildWorld } from "../mossbell/art/world";
import { mossbell } from "../mossbell/game/rules";

const game = mossbell(buildWorld());
const DOWN = { x: 0, y: 1 };
const ACT = { type: "press", action: "act" } as const;
const ada = { name: "Ada", look: DEFAULT_LOOK };
const movedIn = run(game, [{ type: "dress", villager: ada }]);

test("moving in closes the wardrobe and keeps the villager for the next visit", () => {
  expect(movedIn.model.dressing).toBeUndefined();
  expect(movedIn.effects).toEqual([
    { type: "store", key: "mossbell.villager", value: JSON.stringify(ada) },
  ]);
});

test("a turnip is planted, watered, grown and pulled with one key", () => {
  const atPlot = run(game, ticks(1.5, DOWN), movedIn.model).model;

  expect(game.view(atPlot, game.world).hud.prompt).toBe("Plant turnip");

  const planted = run(game, [ACT], atPlot).model;

  expect(game.view(planted, game.world).hud.prompt).toBe("Water");

  const ripe = run(game, [ACT, ...ticks(12.5)], planted).model;

  expect(game.view(ripe, game.world).hud.prompt).toBe("Pull the turnip");
  expect(run(game, [ACT], ripe).model.pack.crops.turnip).toBe(1);
});

test("a neighbor says each of their lines, then goes back to their walk", () => {
  const juniper = movedIn.model.folk.find(({ id }) => id === "Juniper");

  if (!juniper) throw new Error("Juniper has left the valley.");

  const beside = {
    ...movedIn.model,
    me: { at: { x: juniper.at.x, y: juniper.at.y + 30 }, facing: "up", gait: "idle" },
  } as const;

  expect(game.view(beside, game.world).hud.prompt).toBe("Talk to Juniper");

  const talking = run(game, [ACT], beside).model;

  expect(game.view(talking, game.world).hud.talk?.text).toBe(juniper.lines[0]);
  expect(
    run(
      game,
      juniper.lines.map(() => ACT),
      talking,
    ).model.talk,
  ).toBeUndefined();
});

test("nobody walks into the pond", () => {
  const { me } = run(game, ticks(30, { x: 1, y: 1 }), movedIn.model).model;

  expect(game.world.solids.some((solid) => within(solid, me.at))).toBe(false);
});

test("the same messages always give the same model", () => {
  const msgs = ticks(8, { x: 1, y: 0 });

  expect(run(game, msgs, movedIn.model).model).toEqual(run(game, msgs, movedIn.model).model);
});
