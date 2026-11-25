import { describe, expect, test } from "bun:test";
import { scene } from "svjeez";
import { isLane, placements, type Model } from "svjeez/tools";
import { compile, type Animation, type ElementNode } from "../src/index.ts";
import { easedAt, parseEasing } from "../src/compile/easing.ts";
import { backgroundAt, box, snapshot } from "./fixtures.ts";

const anim = (props: Partial<Animation>): Animation => ({
  kind: "animation",
  name: "a",
  keyframes: [],
  duration: 1000,
  delay: 0,
  endDelay: 0,
  iterations: 1,
  direction: "normal",
  easing: "linear",
  fill: "none",
  currentTime: 0,
  playbackRate: 1,
  playState: "running",
  ...props,
});

const frames = (prop: string, from: string, to: string, easing = "linear") => [
  { offset: 0, easing, props: { [prop]: from } },
  { offset: 1, easing, props: { [prop]: to } },
];

const slide = (props: Partial<Animation> = {}) =>
  anim({ keyframes: frames("transform", "translateX(0px)", "translateX(100px)"), ...props });

/** Compiles one animated 20x20 box, and samples it: its `@track` group's matrix, opacity and its background's fill. */
const sampled = (animations: Animation[], el: Partial<ElementNode> = {}, hold = 4) => {
  const root = box({
    id: "app",
    rect: { x: 0, y: 0, width: 300, height: 100 },
    children: [
      box({
        key: "b",
        rect: { x: 0, y: 0, width: 20, height: 20 },
        background: "rgb(255, 0, 0)",
        animations,
        ...el,
      }),
    ],
  });

  const compiled = compile(snapshot(root), { hold });

  const model = scene(
    { size: compiled.size, duration: compiled.duration, title: "t" },
    () => compiled.element,
  );

  const track = (t: number) => placements(model, t).find((p) => p.key === "app/@track/b/@track")!;
  const fill = (find: (node: Model.SceneNode) => boolean) => model.root.children.find(find);

  return {
    ...compiled,
    model,
    /** Where the box is horizontally. */
    x: (t: number) => track(t).matrix[4],
    /** The angle it is turned to, from -180 to 180. */
    angle: (t: number) => {
      const [a, b] = track(t).matrix;

      return (Math.atan2(b, a) * 180) / Math.PI;
    },
    opacity: (t: number) => track(t).opacity,
    notes: compiled.diagnostics.map((d) => d.what),
    fill,
    /** The box's background color, as `#rrggbb`, at `t`. */
    color: (t: number) => backgroundAt(model, "app/b", t),
  };
};

describe("a running animation continues from the captured moment", () => {
  test("elapsed time is where scene time 0 starts, and playbackRate how fast it goes", () => {
    const out = sampled([slide({ duration: 2000, currentTime: 500 })]);

    expect(out.x(0)).toBeCloseTo(25, 3);
    expect(out.x(1)).toBeCloseTo(75, 3);
    expect(out.x(1.5)).toBeCloseTo(100, 3);
    expect(out.x(3)).toBeCloseTo(0, 3);

    const fast = sampled([slide({ duration: 2000, currentTime: 500, playbackRate: 2 })]);

    expect(fast.x(0.5)).toBeCloseTo(75, 3);
    expect(fast.x(0.75)).toBeCloseTo(100, 3);
    expect(out.notes).toEqual([]);
  });

  test("a delay still to wait shows the static layout, then starts", () => {
    const out = sampled([slide({ currentTime: 0, delay: 1000 })], {
      transform: { matrix: [1, 0, 0, 1, 7, 0], origin: [0, 0] },
    });

    expect(out.x(0)).toBeCloseTo(7, 3);
    expect(out.x(0.9)).toBeCloseTo(7, 3);
    expect(out.x(1)).toBeCloseTo(0, 3);
    expect(out.x(1.5)).toBeCloseTo(50, 3);
  });

  test("fill backwards shows the first keyframe while it waits; forwards keeps the last", () => {
    const waits = sampled([slide({ delay: 1000, fill: "backwards" })], {
      transform: { matrix: [1, 0, 0, 1, 7, 0], origin: [0, 0] },
    });

    expect(waits.x(0.5)).toBeCloseTo(0, 3);

    const keeps = sampled([slide({ fill: "forwards" })]);

    expect(keeps.x(0.5)).toBeCloseTo(50, 3);
    expect(keeps.x(3)).toBeCloseTo(100, 3);

    const both = sampled([slide({ fill: "both", delay: 500 })]);

    expect(both.x(0)).toBeCloseTo(0, 3);
    expect(both.x(3)).toBeCloseTo(100, 3);
  });

  test("iterations repeat it, and the last may be left", () => {
    const out = sampled([slide({ iterations: 2, currentTime: 250 })]);

    expect(out.x(0)).toBeCloseTo(25, 3);
    expect(out.x(0.75)).toBeCloseTo(100, 3);
    expect(out.x(0.8)).toBeCloseTo(5, 1);
    expect(out.x(1.8)).toBeCloseTo(0, 3);
  });

  test("directions: reverse runs from the end, alternate turns round each iteration", () => {
    const reverse = sampled([slide({ direction: "reverse" })]);

    expect(reverse.x(0)).toBeCloseTo(100, 3);
    expect(reverse.x(0.25)).toBeCloseTo(75, 3);

    const alternate = sampled([slide({ iterations: 2, direction: "alternate" })]);

    expect(alternate.x(0.5)).toBeCloseTo(50, 3);
    expect(alternate.x(1.25)).toBeCloseTo(75, 3);
    expect(alternate.x(1.75)).toBeCloseTo(25, 3);

    const first = sampled([slide({ iterations: 2, direction: "alternate-reverse" })]);

    expect(first.x(0.25)).toBeCloseTo(75, 3);
    expect(first.x(1.25)).toBeCloseTo(25, 3);
  });

  test("an infinite animation keeps its phase and loops", () => {
    const out = sampled([slide({ iterations: "infinite", currentTime: 2250 })]);

    expect(out.x(0)).toBeCloseTo(25, 3);
    expect(out.x(0.5)).toBeCloseTo(75, 3);
    expect(out.x(0.74)).toBeCloseTo(99, 0);
    expect(out.x(0.76)).toBeCloseTo(1, 0);
    expect(out.x(1)).toBeCloseTo(25, 3);
    expect(out.x(3.5)).toBeCloseTo(75, 3);

    const back = sampled([
      slide({ iterations: "infinite", direction: "alternate", currentTime: 1500 }),
    ]);

    expect(back.x(0)).toBeCloseTo(50, 3);
    expect(back.x(0.25)).toBeCloseTo(25, 3);
    expect(back.x(0.5)).toBeCloseTo(0, 3);
    expect(back.x(0.75)).toBeCloseTo(25, 3);
    expect(back.x(1.5)).toBeCloseTo(100, 3);
    expect(back.x(2.75)).toBeCloseTo(25, 3);
  });

  test("an infinite animation that waits out a delay starts later", () => {
    const out = sampled([slide({ iterations: "infinite", delay: 1500 })], {}, 4);

    expect(out.x(1)).toBeCloseTo(0, 3);
    expect(out.x(2)).toBeCloseTo(50, 3);
    expect(out.x(2.25)).toBeCloseTo(75, 3);
    expect(out.x(3.25)).toBeCloseTo(75, 2);
    expect(out.x(3.75)).toBeCloseTo(25, 2);
  });

  test("a spin keeps its turns, from an implicit start", () => {
    const spin = anim({
      keyframes: [{ offset: 1, easing: "linear", props: { transform: "rotate(360deg)" } }],
      iterations: "infinite",
      duration: 2000,
      currentTime: 500,
    });

    const out = sampled([spin], { rect: { x: 0, y: 0, width: 20, height: 20 } });

    expect(out.angle(0)).toBeCloseTo(90, 3);
    expect(out.angle(0.5)).toBeCloseTo(180, 3);
    expect(out.angle(1.25)).toBeCloseTo(-45, 3);
    expect(out.angle(2.25)).toBeCloseTo(135, 3);

    const turns = sampled([
      anim({ keyframes: frames("transform", "rotate(0deg)", "rotate(720deg)"), duration: 4000 }),
    ]);

    const turned = (t: number) => ((turns.angle(t) % 360) + 360) % 360;

    expect(turned(0.5)).toBeCloseTo(90, 1);
    expect(turned(1)).toBeCloseTo(180, 1);
    expect(turned(1.5)).toBeCloseTo(270, 1);
    expect(turned(2.5)).toBeCloseTo(90, 1);
  });

  test("the individual transform properties, percentages and skew compose in CSS order", () => {
    const out = sampled([
      anim({
        keyframes: [
          { offset: 0, easing: "linear", props: { translate: "0px", transform: "skewX(0deg)" } },
          { offset: 1, easing: "linear", props: { translate: "50%", transform: "skewX(45deg)" } },
        ],
      }),
    ]);

    expect(out.x(0)).toBeCloseTo(0, 3);

    const half = placements(out.model, 0.5).find((p) => p.key === "app/@track/b/@track")!;

    expect(half.matrix[4]).toBeCloseTo(5, 3);
    expect(half.matrix[2]).toBeCloseTo(Math.tan(Math.PI / 8), 4);
  });

  test("opacity, and a background color, are driven and replace the static ones", () => {
    const out = sampled(
      [
        anim({
          keyframes: [
            ...frames("opacity", "1", "0.2"),
            { offset: 0, easing: "linear", props: { backgroundColor: "rgb(255, 0, 0)" } },
            { offset: 1, easing: "linear", props: { backgroundColor: "rgb(0, 0, 255)" } },
          ].sort((a, b) => a.offset - b.offset),
          fill: "forwards",
        }),
      ],
      { opacity: 0.6 },
    );

    expect(out.opacity(0)).toBeCloseTo(1, 3);
    expect(out.opacity(0.5)).toBeCloseTo(0.6, 3);
    expect(out.opacity(2)).toBeCloseTo(0.2, 3);

    const background = out.model.root.children
      .flatMap(function walk(node: Model.SceneNode): Model.SceneNode[] {
        return [node, ...("children" in node ? node.children.flatMap(walk) : [])];
      })
      .find((node) => node.key === "app/@track/b/@track/background");

    expect(background?.kind === "shape" && isLane(background.fill)).toBe(true);
    expect(out.notes).toEqual([]);
  });

  test("a color, a transform and an opacity return to their base when the animation ends mid-flight", () => {
    const out = sampled(
      [
        anim({
          keyframes: [
            {
              offset: 0,
              easing: "linear",
              props: {
                backgroundColor: "rgb(255, 0, 0)",
                transform: "translateX(0px)",
                opacity: "1",
              },
            },
            {
              offset: 1,
              easing: "linear",
              props: {
                backgroundColor: "rgb(0, 0, 255)",
                transform: "translateX(100px)",
                opacity: "0.2",
              },
            },
          ],
          duration: 2000,
          currentTime: 500,
        }),
      ],
      {
        background: "rgb(120, 120, 120)",
        opacity: 0.8,
        transform: { matrix: [1, 0, 0, 1, 25, 0], origin: [0, 0] },
        base: {
          backgroundColor: "rgb(0, 128, 0)",
          transform: "matrix(1, 0, 0, 1, 7, 0)",
          translate: "none",
          rotate: "none",
          scale: "none",
          opacity: "0.5",
        },
      },
    );

    expect(out.x(0)).toBeCloseTo(25, 3);
    expect(out.x(3)).toBeCloseTo(7, 3);
    expect(out.opacity(3)).toBeCloseTo(0.5, 3);
    expect(out.color(3)).toBe("#008000");
    expect(out.color(0)).toBe("#bf0040");
    expect(out.notes).toEqual([]);
  });

  test("with a fill it holds the last keyframe, and before a delay it shows the base", () => {
    const frames2 = [
      { offset: 0, easing: "linear", props: { backgroundColor: "rgb(255, 0, 0)" } },
      { offset: 1, easing: "linear", props: { backgroundColor: "rgb(0, 0, 255)" } },
    ];

    const base = { backgroundColor: "rgb(0, 128, 0)" };

    const held = sampled([anim({ keyframes: frames2, fill: "forwards", currentTime: 500 })], {
      base,
    });

    expect(held.color(3)).toBe("#0000ff");

    const waiting = sampled([anim({ keyframes: frames2, delay: 1000, currentTime: 0 })], { base });

    expect(waiting.color(0.5)).toBe("#008000");
    expect(waiting.color(5)).toBe("#008000");
  });

  test("a color with no base says that it keeps its last keyframe", () => {
    const out = sampled([
      anim({
        keyframes: [
          { offset: 0, easing: "linear", props: { backgroundColor: "rgb(255, 0, 0)" } },
          { offset: 1, easing: "linear", props: { backgroundColor: "rgb(0, 0, 255)" } },
        ],
        currentTime: 500,
      }),
    ]);

    expect(out.notes.join("\n")).toContain("keeps its last keyframe");
  });

  test("easing: a cubic-bezier is cut at the captured moment, and steps jump", () => {
    const easing = "cubic-bezier(0.42, 0, 0.58, 1)";

    const eased = sampled([
      anim({
        keyframes: frames("transform", "translateX(0px)", "translateX(100px)", easing),
        currentTime: 300,
      }),
    ]);

    const curve = parseEasing(easing)!;

    for (const t of [0, 0.2, 0.5, 0.7])
      expect(eased.x(t)).toBeCloseTo(100 * easedAt(curve, 0.3 + t), 1);

    const stepped = sampled([
      anim({
        keyframes: frames(
          "transform",
          "translateX(0px)",
          "translateX(100px)",
          "steps(4, jump-end)",
        ),
      }),
    ]);

    expect(stepped.x(0.1)).toBeCloseTo(0, 3);
    expect(stepped.x(0.3)).toBeCloseTo(25, 3);
    expect(stepped.x(0.9)).toBeCloseTo(75, 3);
  });

  test("a transition's own easing is the effect's, and it holds its end", () => {
    const out = sampled([
      anim({
        kind: "transition",
        name: "transform",
        keyframes: frames("transform", "translateX(0px)", "translateX(100px)"),
        easing: "ease-in",
        duration: 2000,
        currentTime: 500,
      }),
    ]);

    const curve = parseEasing("ease-in")!;

    expect(out.x(0)).toBeCloseTo(100 * easedAt(curve, 0.25), 1);
    expect(out.x(1)).toBeCloseTo(100 * easedAt(curve, 0.75), 1);
    expect(out.x(3)).toBeCloseTo(100, 3);
  });

  test("what cannot be compiled is said, and paused animations are left as captured", () => {
    const out = sampled([
      anim({
        keyframes: [
          {
            offset: 0,
            easing: "linear(0, 1)",
            props: { transform: "translateX(0px)", width: "10px" },
          },
          {
            offset: 1,
            easing: "linear(0, 1)",
            props: { transform: "translateX(2em)", width: "20px" },
          },
        ],
      }),
    ]);

    expect(out.notes.join("\n")).toContain("the property width is not compiled");
    expect(out.notes.join("\n")).toContain("could not be read");

    const paused = sampled([slide({ playState: "paused", currentTime: 500 })], {
      transform: { matrix: [1, 0, 0, 1, 50, 0], origin: [0, 0] },
    });

    expect(paused.x(0)).toBeCloseTo(50, 3);
    expect(paused.x(2)).toBeCloseTo(50, 3);
    expect(paused.notes).toEqual([]);
  });

  test("the scene rests long enough to see them unless told", () => {
    const root = (animations: Animation[]) =>
      snapshot(
        box({
          id: "app",
          children: [box({ key: "b", rect: { x: 0, y: 0, width: 20, height: 20 }, animations })],
        }),
      );

    expect(compile(root([slide({ duration: 3000, currentTime: 1000 })])).duration).toBeCloseTo(2);
    expect(compile(root([slide({ iterations: "infinite", duration: 5000 })])).duration).toBeCloseTo(
      5,
    );
    expect(compile(root([])).duration).toBeCloseTo(0.8);
    expect(compile(root([slide({ duration: 3000 })]), { hold: 1 }).duration).toBeCloseTo(1);
  });
});

describe("animations across several states", () => {
  const spin = (currentTime = 0) =>
    anim({
      name: "spin",
      keyframes: frames("transform", "rotate(0deg)", "rotate(360deg)"),
      iterations: "infinite",
      currentTime,
    });

  /** One 20x20 box per state, moving right by 100 in each; its animations per state, or undefined where it is not there. */
  const film = (per: (Animation[] | undefined)[], over = 1, hold = 1) => {
    const states = per.map((animations, i) => ({
      name: `s${i}`,
      snapshot: snapshot(
        box({
          id: "app",
          rect: { x: 0, y: 0, width: 400, height: 100 },
          children: animations
            ? [
                box({
                  key: "b",
                  rect: { x: i * 100, y: 0, width: 20, height: 20 },
                  background: "rgb(255, 0, 0)",
                  animations,
                }),
              ]
            : [],
        }),
      ),
    }));

    const compiled = compile(states, { over, hold });

    const model = scene(
      { size: compiled.size, duration: compiled.duration, title: "t" },
      () => compiled.element,
    );

    const at = (t: number) => placements(model, t).find((p) => p.key === "app/@track/b/@track")!;

    return {
      ...compiled,
      angle: (t: number) => {
        const [a, b] = at(t).matrix;

        return (Math.atan2(b, a) * 180) / Math.PI;
      },
      opacity: (t: number) => at(t).opacity,
    };
  };

  /** Two angles are the same turn, to a degree. */
  const turned = (angle: number, expected: number) => {
    const gap = ((((angle - expected) % 360) + 540) % 360) - 180;

    expect(Math.abs(gap)).toBeLessThan(1);
  };

  test("a spinner present in every state keeps spinning through the moves, from the first capture's phase", () => {
    const out = film([[spin(250)], [spin(700)], [spin(100)]]);

    expect(out.diagnostics).toEqual([]);
    expect(out.duration).toBe(5);

    for (const t of [0, 0.5, 1.5, 2.25, 3.5, 4.75]) turned(out.angle(t), 90 + 360 * t);
  });

  test("an animation in one state plays from where that state's hold starts, and holds still outside", () => {
    const out = film([[], [spin()], []]);

    turned(out.angle(0.5), 0);
    turned(out.angle(1.5), 0);
    turned(out.angle(2.25), 90);
    turned(out.angle(2.75), 270);
    turned(out.angle(3.5), 0);
    turned(out.angle(4.5), 0);
  });

  test("a different animation in the next state ends the first and starts the other", () => {
    const pulse = anim({
      name: "pulse",
      keyframes: frames("opacity", "1", "0.5"),
      iterations: "infinite",
    });

    const out = film([[spin()], [pulse]]);

    turned(out.angle(0.25), 90);
    expect(out.opacity(0.5)).toBeCloseTo(1, 3);
    expect(out.opacity(2.25)).toBeLessThan(1);
  });

  test("an element that enters or exits keeps animating while it fades", () => {
    const out = film([undefined, [spin()], undefined]);

    turned(out.angle(1.25), 90);
    expect(out.opacity(1.25)).toBeLessThan(1);
    turned(out.angle(2.5), 360 * 1.5);
    turned(out.angle(3.5), 360 * 2.5);
    expect(out.opacity(3.5)).toBeLessThan(1);
    expect(out.opacity(3.5)).toBeGreaterThan(0);
  });
});
