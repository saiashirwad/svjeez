import { describe, expect, test } from "bun:test";
import { def, render, sampled, type Motion } from "svjeez";

interface Key {
  readonly at: number;
  readonly x: number;
  readonly y: number;
}

const PERIOD = 12;

const scene = (animation: Motion<"x" | "y" | "opacity">, duration: number) =>
  render(
    { width: 100, height: 100, duration, title: "Test" },
    <rect width={10} height={10} animation={animation} />,
  );

const lane = (svg: string, property: string): string[] =>
  [...svg.matchAll(/@keyframes [\w-]+\{(.*)\}$/gm)].flatMap((match) =>
    match[1]!.includes(`${property}:`) ? [match[1]!] : [],
  );

const translateKeys = (svg: string, duration: number): Key[] => {
  const [body] = lane(svg, "translate");

  return [...body!.matchAll(/([\d.%,]+)\{translate:(-?[\d.]+)px (-?[\d.]+)px\}/g)]
    .flatMap(([, percents, x, y]) =>
      percents!.split(",").map((percent) => ({
        at: (parseFloat(percent) / 100) * duration,
        x: Number(x),
        y: Number(y),
      })),
    )
    .sort((a, b) => a.at - b.at);
};

const replay = (keys: readonly Key[], t: number): Key => {
  const j = Math.max(
    1,
    keys.findIndex((key) => key.at >= t),
  );

  const [a, b] = [keys[j - 1]!, keys[j]!];
  const u = (t - a.at) / (b.at - a.at);

  return { at: t, x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u };
};

const circle = (t: number) => ({
  x: 100 * Math.cos((2 * Math.PI * t) / PERIOD),
  y: 100 * Math.sin((2 * Math.PI * t) / PERIOD),
});

describe("sampled", () => {
  test("a circle at 1px tolerance replays within 1px of every sample, with far fewer keys", () => {
    const step = 0.05;

    const keys = translateKeys(
      scene(sampled(circle, { duration: PERIOD, step, tolerance: { translate: 1 } }), PERIOD),
      PERIOD,
    );

    let worst = 0;

    for (let i = 0; i <= PERIOD / step; i++) {
      const t = i * step;
      const at = replay(keys, t);
      worst = Math.max(worst, Math.hypot(at.x - circle(t).x, at.y - circle(t).y));
    }

    expect(worst).toBeLessThanOrEqual(1);
    expect(keys.length).toBeLessThan(PERIOD / step / 4);
  });

  test("a flat opacity lane keeps only its two end keys beside a moving translate", () => {
    const svg = scene(
      sampled((t) => ({ ...circle(t), opacity: 0.5 }), {
        duration: PERIOD,
        tolerance: { translate: 1, opacity: 0.02 },
      }),
      PERIOD,
    );

    expect(lane(svg, "opacity")).toEqual(["0%,100%{opacity:0.5}"]);
    expect(translateKeys(svg, PERIOD).length).toBeGreaterThan(2);
  });

  test("a property is its own lane with its own tolerance", () => {
    const depth = def.property("depth", { syntax: "number", inherits: false, initial: 0 });
    const flat = def.property("flat", { syntax: "number", inherits: false, initial: 0 });

    const motion = sampled((t) => ({ ...circle(t), [depth]: circle(t).x, [flat]: 2 }), {
      duration: PERIOD,
      tolerance: { translate: 1, [depth]: 0.001, [flat]: 0.01 },
    });

    const svg = render(
      { width: 100, height: 100, duration: PERIOD, title: "Test" },
      <rect width={10} height={10} animation={motion} />,
    );

    const [depthLane] = lane(svg, "--p1");
    expect(depthLane!.split("}").length).toBeGreaterThan(translateKeys(svg, PERIOD).length);
    expect(lane(svg, "--p2")).toEqual(["0%,100%{--p2:2}"]);
  });

  test("a step that leaves a sliver before the end still renders", () => {
    const svg = scene(
      sampled((t) => ({ x: 10 * t }), {
        duration: 1,
        step: 0.3333333,
        tolerance: { translate: 0.001 },
      }),
      1,
    );

    expect(translateKeys(svg, 1).at(-1)).toMatchObject({ at: 1, x: 10 });
  });

  test("a last step shorter than the scene can tell apart still renders", () => {
    const motion = sampled((t) => ({ x: 100 * t }), {
      duration: 0.1,
      step: 0.09999,
      tolerance: { translate: 0 },
    });

    const [body] = lane(scene(motion, 20), "translate");
    expect(body).toBe(
      "0%{translate:0px 0px}0.5%{translate:9.999px 0px;animation-timing-function:steps(1)}0.501%,100%{translate:10px 0px}",
    );
  });

  test("a jump in the function is a cut, not a tween across it", () => {
    const svg = render(
      { width: 100, height: 100, duration: 2, title: "Test" },
      <rect
        width={10}
        height={10}
        animation={sampled((t) => ({ rotate: t < 1 ? 360 * t : 0 }), {
          duration: 2,
          tolerance: { rotate: 0.5 },
        })}
      />,
    );

    const [body] = lane(svg, "rotate");

    const keys = [...body!.matchAll(/([\d.%,]+)\{rotate:(-?[\d.]+)deg([^}]*)\}/g)]
      .flatMap(([, percents, value, rest]) =>
        percents!.split(",").map((percent) => ({
          at: parseFloat(percent) / 50,
          rotate: Number(value),
          held: rest!.includes("steps(1)"),
        })),
      )
      .sort((a, b) => a.at - b.at);

    const top = keys.findIndex((key) => key.rotate > 359);
    expect(keys[top]!.held).toBe(true);
    expect(keys[top + 1]!.rotate).toBe(0);
    expect(keys[top + 1]!.at - keys[top]!.at).toBeLessThan(0.001);
  });

  test("a steep but smooth function keeps its tween", () => {
    const steep = (t: number) => ({ x: 100 / (1 + Math.exp(-(t - 1) * 400)) });

    const [body] = lane(
      scene(sampled(steep, { duration: 2, tolerance: { translate: 0.5 } }), 2),
      "translate",
    );

    expect(body).not.toContain("steps(1)");
  });

  test("a lane without a tolerance is an error", () => {
    // @ts-expect-error opacity has no tolerance
    expect(() => sampled(() => ({ opacity: 1 }), { duration: 1, tolerance: {} })).toThrow(
      /tolerance for `opacity`/,
    );
  });

  test("samples whose keys change partway are an error", () => {
    const options = { duration: 2, tolerance: { translate: 1, opacity: 0.1 } };
    expect(() => sampled((t) => (t < 1 ? { x: t, opacity: 1 } : { x: t }), options)).toThrow(
      /different channels at t=1/,
    );
    expect(() => sampled((t) => (t < 1 ? { x: t } : { x: t, opacity: 1 }), options)).toThrow(
      /different channels/,
    );
    expect(() => sampled((t) => ({ x: t, opacity: t < 1 ? 1 : undefined }), options)).toThrow(
      /different channels at t=1/,
    );
  });
});
