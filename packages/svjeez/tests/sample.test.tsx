import { describe, expect, test } from "bun:test";
import { def, ease, motion, render, sample } from "svjeez";
import { openScene, renderFrames } from "svjeez/frames";

const browser = await renderFrames(
  render({ width: 4, height: 4, duration: 1, title: "Probe" }, <rect width={4} height={4} />),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

const slide = motion({ x: 0 }).to({ x: 10 }, 1, ease.linear);

describe("sample", () => {
  test("blends between keys with the transition's ease", () => {
    expect(sample(slide, 0.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, 1.5, { duration: 2 })).toEqual({ x: 10 });

    const popped = sample(motion({ scale: 1 }).to({ scale: 2 }, 1, ease.pop), 0.6, {
      duration: 1,
    });

    expect(popped.scale).toBeGreaterThan(2);
  });

  test("a cut holds the old value up to it", () => {
    const cut = motion({ opacity: 1 }).at(1).set({ opacity: 0 });

    expect(sample(cut, 0.99, { duration: 2 })).toEqual({ opacity: 1 });
    expect(sample(cut, 1.01, { duration: 2 })).toEqual({ opacity: 0 });
  });

  test("the scene loops unless loop is false, which holds the last frame", () => {
    expect(sample(slide, 2.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, -1.5, { duration: 2 })).toEqual({ x: 5 });
    expect(sample(slide, 2.5, { duration: 2, loop: false })).toEqual({ x: 10 });
  });

  test("a loop snaps to divide the scene, as render runs it", () => {
    const spin = motion({ rotate: 0 }).to({ rotate: 360 }, 0.9, ease.linear).loop(0.9);

    expect(sample(spin, 1.5, { duration: 3 }).rotate).toBeCloseTo(180);
  });

  test("layers add up: x, y and rotate add, opacity and scale multiply", () => {
    const values = sample(
      [
        motion({ x: 4, opacity: 0.5, rotate: 10 }),
        motion({ x: 1, y: 2, opacity: 0.5, scale: 2 }),
        false,
        motion({ scale: 3, rotate: 5 }),
      ],
      0,
      { duration: 1 },
    );

    expect(values).toEqual({ x: 5, y: 2, opacity: 0.25, rotate: 15, scale: 6 });
  });

  test("reads numeric properties, and leaves colors out", () => {
    const glow = def.property("glow", { syntax: "number", inherits: false, initial: 0 });

    const lit = motion({ [glow]: 0, fill: "#000000" }).to(
      { [glow]: 1, fill: "#ffffff" },
      1,
      ease.linear,
    );

    expect(sample(lit, 0.25, { duration: 1 })).toEqual({ [glow]: 0.25 });
  });

  test("errors name what is missing", () => {
    expect(() => sample(motion().to({ width: 10 }, 1), 0, { duration: 1 })).toThrow(
      "sample() needs a starting value for width. Pass it to motion({ width: … }).",
    );
    expect(() => sample([motion({ width: 1 }), motion({ width: 2 })], 0, { duration: 1 })).toThrow(
      "Two motions both animate `width` in sample(): put them in one motion().",
    );
  });

  test.if(browser)("matches where the browser draws the element", async () => {
    const stack = [
      motion({ x: 0, y: 0 })
        .at(0.2)
        .to({ x: 60, y: 20 }, 1, ease.inOut)
        .to({ x: 10 }, 0.5, ease.pop),
      motion({ opacity: 1 }).to({ opacity: 0.2 }, 0.6, ease.in).loop(0.9),
    ];

    const svg = render(
      { width: 100, height: 100, duration: 3, title: "Sample" },
      <rect id="box" width={10} height={10} animation={stack} />,
    );

    const page = await openScene(svg);

    try {
      for (const time of [0.3, 0.75, 1.1, 1.45, 2.6]) {
        await page.capture(time);

        const drawn = await page.evaluate(() => {
          const box = document.querySelector("#box")!;
          let opacity = 1;

          for (let at: Element | null = box; at && at.tagName !== "svg"; at = at.parentElement)
            opacity *= Number(getComputedStyle(at).opacity);

          const { x, y } = box.getBoundingClientRect();

          return { x, y, opacity };
        }, undefined);

        const values = sample(stack, time, { duration: 3 });

        expect(drawn.x).toBeCloseTo(values.x ?? NaN, 0);
        expect(drawn.y).toBeCloseTo(values.y ?? NaN, 0);
        expect(drawn.opacity).toBeCloseTo(values.opacity ?? NaN, 2);
      }
    } finally {
      await page.close();
    }
  });
});
