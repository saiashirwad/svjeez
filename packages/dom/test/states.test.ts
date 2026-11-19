import { describe, expect, test } from "bun:test";
import { scene } from "svjeez";
import { boxesOf, svg } from "svjeez/tools";
import { compile, type ElementNode, type State } from "../src/index.ts";
import { box, snapshot, words } from "./fixtures.ts";

const state = (name: string, root: ElementNode, timing: Partial<State> = {}): State => ({
  name,
  snapshot: snapshot(root),
  ...timing,
});

const page = (...children: ElementNode[]) =>
  box({ id: "app", rect: { x: 0, y: 0, width: 300, height: 200 }, children });

const at = (key: string, x: number, y: number, props: Partial<ElementNode> = {}) =>
  box({ key, rect: { x, y, width: 40, height: 20 }, background: "rgb(255, 0, 0)", ...props });

/** Compiles `states` and places everything at time `t`: the boxes by path. */
const drawn = (states: readonly State[], over = 1, hold = 1) => {
  const compiled = compile(states, { over, hold });

  const model = scene(
    { size: compiled.size, duration: compiled.duration, title: "dom" },
    () => compiled.element,
  );

  return { ...compiled, model, boxes: (t: number) => boxesOf(model, t), svg: svg.emit(model) };
};

/** Where the element with `key`, a child of the root, has its top-left corner. */
const where = (boxes: ReturnType<typeof boxesOf>, key: string) => {
  const found = boxes[`app/@track/${key}`];

  return found && [found.x, found.y];
};

describe("compileStates", () => {
  test("rests, moves over the move's seconds, rests again", () => {
    const out = drawn([state("a", page(at("box", 10, 20))), state("b", page(at("box", 110, 70)))]);

    expect(out.duration).toBe(3);
    expect(where(out.boxes(0.5), "box")).toEqual([10, 20]);

    const [mx, my] = where(out.boxes(1.5), "box")!;

    expect(mx).toBeGreaterThan(10);
    expect(mx).toBeLessThan(110);
    expect(my).toBeGreaterThan(20);
    expect(my).toBeLessThan(70);

    const [ex, ey] = where(out.boxes(2.5), "box")!;

    expect(ex).toBeCloseTo(110, 3);
    expect(ey).toBeCloseTo(70, 3);
  });

  test("defaults: 0.6s moves, 0.8s holds, and each state can say its own", () => {
    const a = state("a", page(at("box", 0, 0)));
    const b = state("b", page(at("box", 90, 0)));

    expect(compile([a, b]).duration).toBeCloseTo(0.8 + 0.6 + 0.8);

    expect(compile([a, { ...b, over: 2, hold: 0.1 }]).duration).toBeCloseTo(0.8 + 2 + 0.1);
  });

  test("a move into a state takes that state's ease", () => {
    const a = state("a", page(at("box", 0, 0)));
    const b = state("b", page(at("box", 100, 0)), { ease: "linear" });

    const mid = drawn([a, b]).boxes(1.5)["app/@track/box"]!;

    expect(mid.x).toBeCloseTo(50, 3);
  });

  test("an element only in the second state fades in; one only in the first fades out", () => {
    const out = drawn([state("a", page(at("gone", 0, 0))), state("b", page(at("new", 100, 0)))]);

    // Each fades: one opacity keyframe set down, one up.
    expect(out.svg).toContain("opacity:1}66.667%,100%{opacity:0");
    expect(out.svg).toContain("opacity:0}66.667%,100%{opacity:1");
  });

  test("a list with an item added, one removed and one reordered compiles, and ends where the last state is", () => {
    const row = (key: string, y: number) => at(key, 0, y);
    const first = state("a", page(row("a", 0), row("b", 30), row("c", 60)));
    const last = state("b", page(row("c", 0), row("d", 30), row("a", 60)));
    const out = drawn([first, last]);

    expect(where(out.boxes(out.duration), "c")).toEqual([0, 0]);
    expect(where(out.boxes(out.duration), "a")).toEqual([0, 60]);
    expect(where(out.boxes(out.duration), "d")).toEqual([0, 30]);
    expect(where(out.boxes(0), "a")).toEqual([0, 0]);
  });

  test("a clip in one state only, and a shadow that is a blur in the other, still blend", () => {
    const out = drawn([
      state(
        "a",
        page(
          at("box", 0, 0, {
            clip: { x: true, y: true },
            children: [at("inner", 0, 0)],
            shadows: [{ x: 0, y: 2, blur: 4, spread: 0, color: "rgb(0, 0, 0)", inset: false }],
          }),
        ),
      ),
      state(
        "b",
        page(
          at("box", 50, 0, {
            children: [at("inner", 50, 0)],
            shadows: [{ x: 0, y: 2, blur: 4, spread: 2, color: "rgb(0, 0, 0)", inset: false }],
          }),
        ),
      ),
    ]);

    // The shadow's spread grows the box's bounds by 2.
    expect(where(out.boxes(out.duration), "box")).toEqual([48, 0]);
  });

  test("text that changes crossfades without throwing", () => {
    const out = drawn([
      state("a", page(box({ key: "t", tag: "p", children: [words("empty")] }))),
      state("b", page(box({ key: "t", tag: "p", children: [words("typed")] }))),
    ]);

    expect(out.svg).toContain("empty");
    expect(out.svg).toContain("typed");
  });

  test("a card with the same data-key under another parent glides across", () => {
    const column = (id: string, x: number, ...kids: ElementNode[]) =>
      box({ id, rect: { x, y: 0, width: 100, height: 200 }, children: kids });

    const out = drawn([
      state("a", page(column("left", 0, at("card", 10, 20)), column("right", 150))),
      state("b", page(column("left", 0), column("right", 150, at("card", 160, 60)))),
    ]);

    expect(out.diagnostics).toEqual([]);
    expect(where(out.boxes(0), "card")).toEqual([10, 20]);

    const [mx] = where(out.boxes(1.5), "card")!;

    expect(mx).toBeGreaterThan(10);
    expect(mx).toBeLessThan(160);
    expect(where(out.boxes(out.duration), "card")).toEqual([160, 60]);
  });

  test("a single Snapshot compiles as one state, and no states is an error", () => {
    const one = compile(snapshot(page(at("box", 0, 0))));

    expect(one.duration).toBeCloseTo(0.8);
    expect(() => compile([])).toThrow("at least one state");
  });

  test("every element has a group to hang its tracks on", () => {
    const { element } = compile(snapshot(page(at("box", 0, 0))));

    expect(JSON.stringify(element)).toContain("@track");
  });
});
