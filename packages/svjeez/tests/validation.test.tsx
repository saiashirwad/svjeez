/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import {
  Camera,
  Focus,
  Marker,
  fx,
  readingTime,
  render,
  shake,
  sampled,
  span,
  stagger,
  valuesAt,
  motion,
  timeline,
  wiggle,
  draw,
} from "svjeez";
import { rect } from "svjeez/geometry";
import { restyle } from "svjeez/page";
import { choice, color, count, number, seconds } from "svjeez/params";

const box = rect(0, 0, 10, 10);

describe("params", () => {
  test("number, count and seconds reject NaN and infinite values and bounds", () => {
    expect(() => number(Number.NaN, { min: 0, max: 1 })).toThrow("is outside its range");
    expect(() => number(0.5, { min: 0, max: Number.NaN })).toThrow("both finite");
    expect(() => number(0.5, { min: -Infinity, max: 1 })).toThrow("both finite");
    expect(() => seconds(1, { max: Infinity })).toThrow("both finite");
    expect(() => seconds(Infinity, { max: 5 })).toThrow("is outside its range");
    expect(() => number(0.5, { min: 0, max: 1, step: Number.NaN })).toThrow("positive finite step");
  });

  test("count needs whole-number bounds", () => {
    expect(() => count(1, { min: 0.5, max: 4 })).toThrow("needs whole-number bounds");
    expect(() => count(1, { max: 4.5 })).toThrow("needs whole-number bounds");
    expect(count(2, { max: 4 }).max).toBe(4);
  });

  test("choice rejects duplicate options", () => {
    expect(() => choice("a", ["a", "b", "a"])).toThrow('needs distinct options, got "a", "b", "a"');
  });

  test("color rejects what is not hex", () => {
    expect(() => color("#GGG")).toThrow("color() needs #rgb or #rrggbb colors, got #GGG.");
    // @ts-expect-error "red" is not a hex color
    expect(() => color("red")).toThrow("color() needs");
    expect(color("#fa0").value).toBe("#fa0");
  });
});

describe("timeline and stagger", () => {
  test("stagger checks its count, step and starts", () => {
    expect(() => stagger(span(1, 1), 1.5, 1)).toThrow(
      "stagger() needs a whole count of 0 or more and a finite step, got count 1.5 and step 1.",
    );
    expect(() => stagger(span(1, 1), 2, Number.NaN)).toThrow("stagger() needs a whole count");
    expect(() => stagger(span(1, 1), 3, -1)).toThrow(
      "stagger() needs a start of 0 or later, got -1.",
    );
    expect(() => stagger({ at: 0, over: -1 }, 2, 1)).toThrow(
      "stagger() needs a length of 0 or more",
    );
    expect(stagger(span(1, 1), 0, 1)).toEqual([]);
  });

  test("timeline has no duration; end is the last scene's end", () => {
    const tl = timeline({ a: 1, b: 2 }, { at: 1, gap: 1 });
    expect(tl.end).toBe(5);
    expect("duration" in tl).toBe(false);
  });

  test("readingTime validates its options", () => {
    expect(() => readingTime("a b", { wps: 0 })).toThrow("readingTime() needs a positive wps");
    expect(() => readingTime("a b", { wps: Number.NaN })).toThrow("readingTime() needs");
    expect(() => readingTime("a b", { min: -1 })).toThrow("readingTime() needs");
    expect(() => readingTime("a b", { settle: Infinity })).toThrow("readingTime() needs");
    expect(readingTime("one two three four five six seven", { wps: 7, settle: 0, min: 0 })).toBe(1);
  });
});

describe("one rule for at and over", () => {
  test("recipes, sampled and clips reject over 0; span() allows a point", () => {
    expect(() => draw({ at: 0, over: 0 })).toThrow("draw() needs a positive over, got 0.");
    expect(() => draw({ at: -1, over: 1 })).toThrow("draw() needs a start of 0 or later, got -1.");
    expect(() =>
      sampled({ at: 0, over: 0 }, () => ({ x: 0 }), { tolerance: { translate: 1 } }),
    ).toThrow("sampled() needs a positive over, got 0.");
    expect(span(2, 0).end).toBe(2);
    expect(() => span(2, -1)).toThrow("span() needs a length of 0 or more, got -1.");
  });
});

describe("rates", () => {
  test("shake and wiggle need a positive finite rate", () => {
    for (const rate of [Number.NaN, 0, -2, Infinity]) {
      expect(() => shake({ at: 0, over: 1 }, { x: 4 }, { rate })).toThrow(
        `shake() needs a positive rate, got ${rate}.`,
      );
      expect(() => wiggle({ x: 4 }, { seed: 1, rate })).toThrow(
        `wiggle() needs a positive rate, got ${rate}.`,
      );
    }
  });
});

describe("restyle and valuesAt", () => {
  const svg = render(
    { width: 10, height: 10, duration: 2, title: "t" },
    <rect width={1} height={1} />,
  );

  test("restyle needs at and onceAt finite and 0 or more", () => {
    expect(() => restyle(svg, { at: -1 })).toThrow("restyle() needs at of 0 or more, got -1.");
    expect(() => restyle(svg, { at: Number.NaN })).toThrow("restyle() needs at of 0 or more");
    expect(() => restyle(svg, { onceAt: Infinity })).toThrow("restyle() needs onceAt of 0 or more");
    expect(restyle(svg, { at: 0, onceAt: 0 })).toContain("<svg");
  });

  test("valuesAt needs a finite duration", () => {
    expect(() => valuesAt(motion({ x: 0 }), 1, { duration: Infinity })).toThrow(
      "valuesAt() needs a positive duration, got Infinity.",
    );
  });
});

describe("components and effects", () => {
  test("Camera rejects empty stops", () => {
    expect(() => Camera({ frame: box, stops: [], children: null })).toThrow(
      "Camera() needs at least one stop, got none.",
    );
  });

  test("fx.boil and fx.grayscale validate instead of clamping", () => {
    expect(() => fx.boil({ seed: 0 })).toThrow(
      "fx.boil() needs a whole-number seed of 1 or more, got 0.",
    );
    expect(() => fx.boil({ seed: 1.5 })).toThrow("fx.boil() needs a whole-number seed");
    expect(() => fx.boil({ rate: 0 })).toThrow("fx.boil() needs a positive rate, got 0.");
    expect(() => fx.boil({ rate: Number.NaN })).toThrow("fx.boil() needs a positive rate");
    expect(() => fx.grayscale({ amount: 2 })).toThrow(
      "fx.grayscale() needs an amount between 0 and 1, got 2.",
    );
    expect(() => fx.grayscale({ amount: Number.NaN })).toThrow("fx.grayscale() needs an amount");
  });

  test("Focus cuts at fade 0 and rejects a bad fade", () => {
    const stops = [{ show: { at: 1, over: 2 }, target: box }];

    const scene = (fade: number) =>
      render({ width: 20, height: 20, duration: 4, title: "f" }, [
        <Focus stops={stops} fade={fade}>
          <rect width={20} height={20} />
        </Focus>,
      ]);

    expect(() => scene(-1)).toThrow("Focus() needs a fade of 0 or more, got -1.");
    expect(() => scene(Number.NaN)).toThrow("Focus() needs a fade of 0 or more");
    expect(scene(0)).toContain("svg");
  });

  test("Marker appears at its first stop's show.at", () => {
    const marker = (at: number) =>
      render(
        { width: 20, height: 20, duration: 4, title: "m" },
        Marker({ stops: [{ show: { at, over: 1 }, target: box }] }),
      );

    expect(marker(0)).not.toContain("opacity:0");
    expect(marker(1)).toContain("opacity");
  });
});
