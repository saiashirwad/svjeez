import { describe, expect, test } from "bun:test";
import { restyle } from "svjeez/page";
import {
  Shape,
  ease,
  motion,
  path,
  rect,
  sampled,
  scene,
  span as clock,
  track,
  type Paint,
  type SceneElement,
} from "svjeez";
import { svg, type Motion } from "svjeez/tools";
import { easeAt } from "../src/model/ease-at";

const DURATION = 10;

const emit = (build: () => SceneElement, duration = DURATION, playbackRate?: number): string =>
  svg.emit(
    scene({ size: [100, 100], title: "Test", duration, still: false }, build),
    playbackRate === undefined ? {} : { playbackRate },
  );

interface Held {
  readonly t: number;
  readonly value: number;
}

const keys = (out: string, property: string, duration = DURATION): Held[] => {
  const block = [...out.matchAll(/@keyframes [\w-]+\{(.*)\}$/gm)].find((match) =>
    match[1]!.includes(`${property}:`),
  );

  if (!block) throw new Error(`no keyframes set ${property}`);

  return [...block[1]!.matchAll(/([\d.%,]+)\{([^}]*)\}/g)]
    .flatMap(([, percents, body]) => {
      const value = new RegExp(`${property}:(-?[\\d.]+)`).exec(body!)?.[1];

      return percents!.split(",").map((percent) => ({
        t: Math.round((parseFloat(percent) / 100) * duration * 1e5) / 1e5,
        value: Number(value),
      }));
    })
    .sort((a, b) => a.t - b.t);
};

const box = (layer: Motion, duration = DURATION): string =>
  emit(() => <Shape geometry={rect(10, 10)} fill="#000000" motion={layer} />, duration);

const x = (value: number): [number, number] => [value, 0];

describe("span()", () => {
  test(".chain() puts spans end to end, one length after another", () => {
    const [crouch, launch, rise] = clock(0.1, 0.3).chain(0.12, 0.25);

    expect([crouch.start, crouch.over]).toEqual([0.1, 0.3]);
    expect([launch.start, launch.over]).toEqual([crouch.end, 0.12]);
    expect([rise.start, rise.over]).toEqual([launch.end, 0.25]);
    expect(clock(2, 1).chain()).toHaveLength(1);
    expect(() => clock(1, 1).chain(-1)).toThrow("next() needs a length of 0 or more, got -1.");

    const [a, b, c] = clock(0.1, 0.3).chain(0.12, 0.25);

    const byHand = motion({ offset: x(0) })
      .to({ offset: x(5) }, clock(0.1, 0.3))
      .to({ offset: x(9) }, clock(0.1, 0.3).next(0.12))
      .to({ offset: x(0) }, clock(0.1, 0.3).next(0.12).next(0.25));

    const chained = motion({ offset: x(0) })
      .to({ offset: x(5) }, a)
      .to({ offset: x(9) }, b)
      .to({ offset: x(0) }, c);

    expect(box(chained)).toBe(box(byHand));
  });

  test("a span knows its end, and shifts and chains into new spans", () => {
    const reach = clock(0, 0.7);
    const grab = reach.next(1, 0.2);

    expect(reach.end).toBeCloseTo(0.7, 9);
    expect([grab.start, grab.over, grab.end]).toEqual(
      [0.9, 1, 1.9].map((n) => expect.closeTo(n, 9)),
    );
    expect(clock(1, 2).shift(2)).toMatchObject({ start: 3, over: 2 });
    expect(clock(1, 2).next(1)).toMatchObject({ start: 3, over: 1 });
  });

  test("a span is not a thenable, so awaiting or returning one from an async function works", async () => {
    expect("then" in clock(1, 2)).toBe(false);
    expect("then" in clock(1)).toBe(false);
    expect(await clock(1, 2)).toMatchObject({ start: 1, over: 2 });
    expect(await (async () => clock(1, 2).next(1))()).toMatchObject({ start: 3, over: 1 });
  });

  test("a span without over runs to the end, and never ends", () => {
    const open = clock(2);

    expect(open.over).toBeUndefined();
    expect(open.end).toBe(Infinity);
    expect(open.shift(1).start).toBe(3);
  });

  test(".cascade() lays out spans step apart, each as long as the first", () => {
    const cascade = clock(1, 0.5).cascade(3, 0.25);

    expect(cascade.map((s) => [s.start, s.over])).toEqual([
      [1, 0.5],
      [1.25, 0.5],
      [1.5, 0.5],
    ]);
    expect(cascade.at(-1)!.end).toBe(2);
    expect(clock(0, 1).cascade(2, 0)[1]).toMatchObject({ start: 0, over: 1 });
  });

  test("a span before 0, or with a negative or infinite length throws", () => {
    expect(() => clock(-1, 1)).toThrow(/start of 0 or later/);
    expect(() => clock(1, -1)).toThrow(/length of 0 or more/);
    expect(() => clock(1, Infinity)).toThrow(/length of 0 or more/);
    expect(() => clock(Number.NaN)).toThrow(/start of 0 or later/);
  });
});

describe(".repeat()", () => {
  const spin = () => motion({ rotate: 0 }).to({ rotate: 360 }, clock(0, 2), ease.linear);

  test("a count plays the passage that many times, each from the initial values", () => {
    expect(keys(box(spin().repeat(3)), "rotate")).toEqual([
      { t: 0, value: 0 },
      { t: 2, value: 360 },
      { t: 2.0001, value: 0 },
      { t: 4, value: 360 },
      { t: 4.0001, value: 0 },
      { t: 6, value: 360 },
      { t: 10, value: 360 },
    ]);
  });

  test("repeat(1) changes nothing", () => {
    expect(box(spin().repeat(1))).toBe(box(spin()));
  });

  test("the passage runs from the earliest step's start to the latest step's end", () => {
    const out = box(
      motion({ offset: x(0) })
        .to({ offset: x(10) }, clock(1, 1), ease.linear)
        .repeat(2),
    );

    expect(keys(out, "translate").map((key) => Math.round(key.t * 1000) / 1000)).toEqual([
      0, 1, 2, 2, 3, 10,
    ]);

    const late = box(
      motion({ offset: x(0) })
        .to({ offset: x(0) }, clock(3, 1), ease.linear)
        .to({ offset: x(10) }, clock(1, 1), ease.linear)
        .repeat(2),
    );

    expect(keys(late, "translate").map((key) => key.t)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 10]);
  });

  test("a passage that ends where it began restarts without a cut", () => {
    const out = box(
      motion({ offset: x(0) })
        .to({ offset: x(10) }, clock(0, 1), ease.linear)
        .to({ offset: x(0) }, clock(0, 1).next(1), ease.linear)
        .repeat(3),
    );

    expect(keys(out, "translate").map((key) => key.value)).toEqual([0, 10, 0, 10, 0, 10, 0, 0]);
  });

  test("until repeats to that time, cutting the last pass short, and holds the value it reached", () => {
    const held = keys(box(spin().repeat({ until: 7 })), "rotate");

    expect(held.at(-2)).toEqual({ t: 7, value: 180 });
    expect(held.at(-1)).toEqual({ t: 10, value: 180 });
    expect(held.filter((key) => key.value === 360)).toHaveLength(3);
  });

  test("until on a pass boundary plays whole passes", () => {
    expect(keys(box(spin().repeat({ until: 6 })), "rotate").at(-2)).toEqual({ t: 6, value: 360 });
    expect(box(spin().repeat({ until: 6 }))).toBe(box(spin().repeat(3)));
  });

  test("a transition cut partway ends on the value the whole transition passed through there", () => {
    const out = box(
      motion({ offset: x(0) })
        .to({ offset: x(100) }, clock(0, 2), ease.out)
        .repeat({ until: 3 }),
    );

    const held = keys(out, "translate");

    expect(held.at(-2)?.t).toBe(3);
    expect(held.at(-2)?.value).toBeCloseTo(100 * easeAt(ease.out, 0.5), 2);
  });

  test("a cut transition keeps the shape of the curve, not a straight line to the cut", () => {
    const out = box(
      motion({ offset: x(0) })
        .to({ offset: x(100) }, clock(0, 2), ease.inOut)
        .repeat({ until: 3 }),
    );

    expect(out).toMatch(/cubic-bezier\(/);
    expect(out).not.toContain("cubic-bezier(.77,0,.175,1);animation-timing-function:linear");
  });

  test("a later step may follow the repeat", () => {
    const out = box(spin().repeat({ until: 4 }).to({ rotate: 90 }, clock(5, 1), ease.linear));

    expect(keys(out, "rotate").at(-2)).toEqual({ t: 6, value: 90 });
  });

  test("two channels restart together, each from its own initial value", () => {
    const out = box(
      motion({ offset: x(5), opacity: 0.5 })
        .to({ offset: x(25), opacity: 1 }, clock(0, 1), ease.linear)
        .repeat(2),
    );

    expect(keys(out, "translate").map((key) => key.value)).toEqual([5, 25, 5, 25, 25]);
    expect(keys(out, "opacity").map((key) => key.value)).toEqual([0.5, 1, 0.5, 1, 1]);
  });

  test("asks for a whole number of plays, a passage, a length and an until after the passage", () => {
    expect(() => spin().repeat(0)).toThrow(/whole number of plays/);
    expect(() => spin().repeat(1.5)).toThrow(/whole number of plays/);
    expect(() => motion({ offset: x(0) }).repeat(2)).toThrow(/needs a passage to repeat/);
    expect(() =>
      motion({ offset: x(0) })
        .set({ offset: x(5) }, clock(0))
        .repeat(2),
    ).toThrow(/needs a passage with a length/);
    expect(() => spin().repeat({ until: 2 })).toThrow(/needs a time after the passage ends, at 2s/);
    expect(() => spin().repeat({ until: Infinity })).toThrow(/finite until/);
  });

  test("a runaway count fails before it unrolls, and a lane past its key cap says why", () => {
    expect(() => spin().repeat(100000)).toThrow(/would unroll 100000 passes/);
    expect(() =>
      box(
        motion({ offset: x(0) })
          .to({ offset: x(1) }, clock(0, 1), ease.linear)
          .repeat(1500),
        3000,
      ),
    ).toThrow(
      /has 3\d{3} keys; the cap is 2000. repeat\(\) unrolls every pass, so use .loop\(period\)/,
    );
  });

  test("stopping a steps() transition off a step edge throws, and on one it cuts cleanly", () => {
    const stepped = () =>
      motion({ offset: x(0) }).to({ offset: x(100) }, clock(0, 2), ease.steps(4));

    expect(() => box(stepped().repeat({ until: 3.2 }))).toThrow(
      /repeat\(\{ until \}\) cuts a steps\(4\) transition between two of its steps/,
    );

    expect(keys(box(stepped().repeat({ until: 3 })), "translate").at(-2)).toEqual({
      t: 3,
      value: 50,
    });
  });

  test("stopping a colour transition partway throws, but a colour that holds there is fine", () => {
    const tint = () => track<Paint>("#000000").to("#FFFFFF", clock(0, 2), ease.linear);

    const painted = (fill: ReturnType<typeof tint>) =>
      emit(() => <Shape geometry={rect(10, 10)} fill={fill} />);

    expect(() => painted(tint().repeat({ until: 3 }))).toThrow(
      /repeat\(\{ until \}\) is cut partway through a transition, and only numbers and points can be cut/,
    );
    expect(painted(tint().repeat({ until: 4 }))).toContain("fill");
  });

  test("nothing follows rewind(), and a repeat can't follow it", () => {
    const rewound = motion({ offset: x(0) })
      .to({ offset: x(10) }, clock(0, 1))
      .rewind(1);

    expect(() => rewound.repeat(2)).toThrow(/can't follow rewind/);
    expect(() => rewound.to({ offset: x(1) }, clock(2, 1))).toThrow(/can't follow rewind/);
    expect(() => rewound.rewind(1)).toThrow(/can't follow rewind/);
  });

  test("a loop shorter than the repeated passages throws", () => {
    expect(() => spin().repeat(3).loop(5)).toThrow(/shorter than the motion/);
  });

  test("a repeat that stops mid-pass moves every channel it touches to where that pass had got", () => {
    const out = box(
      motion({ offset: x(0), opacity: 0 })
        .to({ offset: x(100), opacity: 1 }, clock(0, 2), ease.linear)
        .repeat({ until: 5 }),
    );

    expect(keys(out, "translate").at(-2)).toEqual({ t: 5, value: 50 });
    expect(keys(out, "opacity").at(-2)).toEqual({ t: 5, value: 0.5 });
  });

  test("a repeat of a path morph can stop partway too", () => {
    const morph = track(path.parse("M0 0L10 0"))
      .to(path.parse("M0 0L30 0"), clock(0, 2), ease.linear)
      .repeat({ until: 3 });

    const out = emit(() => <Shape geometry={morph} stroke={{ color: "#000000", width: 1 }} />);

    expect(out).toMatch(/M0 0(?:L20 0|h20)/);
  });
});

describe(".rewind()", () => {
  const out = () => motion({ offset: x(0) }).to({ offset: x(50) }, clock(0, 2), ease.linear);

  test("glides every channel back to its initial value, ending at the scene's end", () => {
    expect(keys(box(out().rewind(1)), "translate")).toEqual([
      { t: 0, value: 0 },
      { t: 2, value: 50 },
      { t: 9, value: 50 },
      { t: 10, value: 0 },
    ]);
  });

  test("a loop's clock ends at its period, so the loop closes", () => {
    const held = keys(box(out().loop(5).rewind(1)), "translate", 5);

    expect(held.at(0)).toEqual({ t: 0, value: 0 });
    expect(held.at(-1)).toEqual({ t: 5, value: 0 });
    expect(held.at(-2)).toEqual({ t: 4, value: 50 });
  });

  test("adds nothing to a motion that is already home, and uses the ease it is given", () => {
    const home = () =>
      motion({ offset: x(0) })
        .to({ offset: x(5) }, clock(0, 1))
        .to({ offset: x(0) }, clock(0, 1).next(1));

    expect(box(home().rewind(1))).toBe(box(home()));
    expect(box(out().rewind(1, ease.linear))).not.toBe(box(out().rewind(1)));
  });

  test("needs the room: a motion still running when the rewind must start throws", () => {
    expect(() =>
      box(
        motion({ offset: x(0) })
          .to({ offset: x(9) }, clock(8, 1.5))
          .rewind(1),
      ),
    ).toThrow(/rewind\(1\) .*needs the last 1s of its 10s clock, but the motion runs until 9.5s/);
  });

  test("a colour comes back to the value it started on", () => {
    const fill = track<Paint>("#112233").to("#FFFFFF", clock(0, 1)).rewind(1);
    const painted = emit(() => <Shape geometry={rect(10, 10)} fill={fill} />);

    expect(painted).toMatch(/0%,100%\{fill:#112233\}/i);
  });
});

describe("sampled() with a window", () => {
  test("plays from the window's start, hands the function time from 0 to over, and holds either side", () => {
    const seen: number[] = [];

    const layer = sampled.motion(
      (t) => {
        seen.push(t);

        return { offset: x(t * 10) };
      },
      clock(4, 2),
      { tolerance: { offset: 0.01 } },
    );

    const held = keys(box(layer), "translate");

    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(2);
    expect(held[0]).toEqual({ t: 0, value: 0 });
    expect(held.at(-1)).toEqual({ t: 10, value: 20 });
    expect(held.find((key) => key.value === 0 && key.t > 0)?.t).toBe(4);
    expect(held.find((key) => key.value === 20)?.t).toBe(6);
  });

  test("asks for a positive over and a start of 0 or later", () => {
    const line = (window: { start: number; over: number }) =>
      sampled((t) => t * 10, window, { tolerance: 0.01 });

    expect(() => line({ start: 0, over: 0 })).toThrow(/sampled\(\) needs a positive over, got 0/);
    expect(() => line({ start: -1, over: 2 })).toThrow(/start of 0 or later/);
  });

  test("a sampled path plays in a SMIL window on the scene's loop", () => {
    const frame = (t: number) => path.parse(`M0 0L${10 + t} 0`);
    const geometry = sampled(frame, clock(2, 3), { tolerance: 0.1 });

    const out = emit(() => <Shape geometry={geometry} stroke={{ color: "#000000", width: 1 }} />);

    expect(out).toContain('keyTimes="0;1" begin="2s;w1.begin+10s" dur="3s"');
  });
});

describe("one clock in the tools", () => {
  const faster = (rate: number) =>
    emit(
      () => (
        <Shape
          geometry={rect(10, 10)}
          fill="#000000"
          motion={motion({ offset: x(0) }).to({ offset: x(4) }, clock(0, 4), ease.linear)}
        />
      ),
      4,
      rate,
    );

  test("a scene played at another rate says so on its root, and one at rate 1 stays as it was", () => {
    expect(faster(2)).toContain('data-playback-rate="2"');
    expect(faster(1)).not.toContain("data-playback-rate");
  });

  test("restyle starts a copy at scene seconds, whatever the rate", () => {
    expect(restyle(faster(1), { at: 2 })).toContain("--t0:-2s");
    expect(restyle(faster(2), { at: 2 })).toContain("--t0:-1s");
  });
});
