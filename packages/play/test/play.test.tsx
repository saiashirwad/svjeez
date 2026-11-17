import { expect, test } from "bun:test";
import {
  game,
  memo,
  roll,
  run,
  sheet,
  step,
  terrainOf,
  ticks,
  walk,
  within,
  type Input,
  type World,
} from "../src/index.ts";

const world: World = {
  svg: "<svg/>",
  width: 200,
  height: 100,
  solids: [{ x: 100, y: 0, width: 20, height: 100 }],
};

const dot = sheet({ width: 10, height: 10, anchor: { x: 5, y: 10 }, duration: 1 }, [
  ["still", <circle cx={5} cy={5} r={4} />],
  ["blink", <circle cx={5} cy={5} r={2} />],
]);

interface Model {
  readonly x: number;
  readonly coins: number;
}

type Msg = { readonly type: "pay"; readonly coins: number };

const walker = game({
  world,
  keys: { jump: ["Space"] },
  init: (): Model => ({ x: 20, coins: 0 }),
  update(model: Model, msg: Msg | Input<"jump">, where) {
    if (msg.type === "tick")
      return {
        ...model,
        x: walk({ x: model.x, y: 50 }, { x: msg.axis.x * 60 * msg.dt, y: 0 }, terrainOf(where)).x,
      };

    if (msg.type === "pay") return { ...model, coins: model.coins + msg.coins };

    if (msg.type === "press")
      return [
        model,
        [{ type: "flash", sheet: dot, at: { x: model.x, y: 50 }, seconds: 1 }],
      ] as const;

    return model;
  },
  view: (model) => ({
    camera: { x: model.x, y: 50 },
    sprites: [{ key: "me", sheet: dot, at: { x: model.x, y: 50 } }],
    hud: model.coins,
  }),
});

test("run plays messages in order from the start", () => {
  const { model, effects } = run(walker, [
    { type: "pay", coins: 2 },
    { type: "pay", coins: 3 },
  ]);

  expect(model).toEqual({ x: 20, coins: 5 });
  expect(effects).toEqual([]);
});

test("an update that returns effects hands them to whoever runs it", () => {
  const { model, effects } = step(walker, { x: 30, coins: 0 }, { type: "press", action: "jump" });

  expect(model).toEqual({ x: 30, coins: 0 });
  expect(effects).toEqual([{ type: "flash", sheet: dot, at: { x: 30, y: 50 }, seconds: 1 }]);
});

test("ticks walk until a solid stops them", () => {
  const { model } = run(walker, ticks(5, { x: 1, y: 0 }));

  expect(model.x).toBeGreaterThan(80);
  expect(model.x).toBeLessThanOrEqual(91);
});

test("a view is the model as data", () => {
  expect(walker.view({ x: 40, coins: 7 }, world)).toEqual({
    camera: { x: 40, y: 50 },
    sprites: [{ key: "me", sheet: dot, at: { x: 40, y: 50 } }],
    hud: 7,
  });
});

test("a sheet holds one group for each state, under names no other sheet has", () => {
  const other = sheet({ width: 10, height: 10, anchor: { x: 0, y: 0 }, duration: 1 }, [
    ["only", <rect width={1} height={1} />],
  ]);

  expect(dot.svg).toContain('data-state="still"');
  expect(dot.svg).toContain('data-state="blink"');
  expect(dot.svg.match(/class="(s\d+-)root"/)?.[1]).not.toBe(
    other.svg.match(/class="(s\d+-)root"/)?.[1],
  );
});

test("memo makes each named thing once", () => {
  let made = 0;

  const numbered = memo(
    (name: string) => `${name}-${made++}`,
    (name) => name,
  );

  expect([numbered("a"), numbered("b"), numbered("a")]).toEqual(["a-0", "b-1", "a-0"]);
});

test("roll gives the same numbers for the same seed, from 0 up to 1", () => {
  const [first, seed] = roll(7);
  const [second] = roll(seed);

  expect(roll(7)[0]).toBe(first);
  expect(first).not.toBe(second);
  expect(first).toBeGreaterThanOrEqual(0);
  expect(first).toBeLessThan(1);
});

test("within takes the left and top edges and leaves the right and bottom", () => {
  const area = { x: 0, y: 0, width: 10, height: 10 };

  expect(within(area, { x: 0, y: 0 })).toBe(true);
  expect(within(area, { x: 10, y: 5 })).toBe(false);
});
