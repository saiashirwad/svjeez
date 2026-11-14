import { describe, expect, test } from "bun:test";
import {
  Clip,
  Once,
  code,
  def,
  ease,
  easeAt,
  motion,
  render,
  flow,
  reveal,
  sampled,
  show,
  span,
  terminal,
  timeline,
  typewriter,
  type Motion,
} from "svjeez";
import { restyle } from "svjeez/page";
import { rotateKeys, valueAt, keysOf } from "../src/keys";
import { during, cut } from "../src/extras/timeline";

const DURATION = 10;

const scene = (child: Parameters<typeof render>[1], duration = DURATION) =>
  render({ width: 100, height: 100, title: "Test", duration, reducedMotion: false }, child);

interface Held {
  readonly t: number;
  readonly value: number;
}

/** The keys of the first keyframes block that sets `property`, as seconds and the number written. */
const keys = (svg: string, property: string, duration = DURATION): Held[] => {
  const block = [...svg.matchAll(/@keyframes [\w-]+\{(.*)\}$/gm)].find((match) =>
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

const rect = (animation: Motion<any>) => <rect width={10} height={10} animation={animation} />;

describe("span()", () => {
  test("a span knows its end, and shifts, chains and pads into new spans", () => {
    const reach = span(0, 0.7);
    const grab = reach.next(1, 0.2);
    const down = grab.pad(0.15);

    expect(reach.end).toBeCloseTo(0.7, 9);
    expect([grab.at, grab.over, grab.end]).toEqual([0.9, 1, 1.9].map((n) => expect.closeTo(n, 9)));
    expect(down.at).toBeCloseTo(0.75, 9);
    expect(down.over).toBeCloseTo(1.3, 9);
    expect(span(1, 2).shift(2)).toMatchObject({ at: 3, over: 2 });
    expect(span(1, 2).next(1)).toMatchObject({ at: 3, over: 1 });
    expect(span(1, 2).pad(1, 0)).toMatchObject({ at: 0, over: 3 });
    expect(span(1, 2).pad(-0.5)).toMatchObject({ at: 1.5, over: 1 });
  });

  test("a span is not a thenable, so awaiting or returning one from an async function works", async () => {
    expect("then" in span(1, 2)).toBe(false);
    expect("then" in span(1)).toBe(false);
    expect(await span(1, 2)).toMatchObject({ at: 1, over: 2 });
    expect(await (async () => span(1, 2).next(1))()).toMatchObject({ at: 3, over: 1 });
  });

  test("a span without over runs to the end, and never ends", () => {
    const open = span(2);

    expect(open.over).toBeUndefined();
    expect(open.end).toBe(Infinity);
    expect(open.shift(1).at).toBe(3);
    expect(open.pad(1).at).toBe(1);
  });

  test("a span before 0, with a negative or infinite length, or padded out of the clock throws", () => {
    expect(() => span(-1, 1)).toThrow(/start of 0 or later/);
    expect(() => span(1, -1)).toThrow(/length of 0 or more/);
    expect(() => span(1, Infinity)).toThrow(/length of 0 or more/);
    expect(() => span(Number.NaN)).toThrow(/start of 0 or later/);
    expect(() => span(1, 2).pad(2)).toThrow(/pad\(\) needs a start of 0 or later/);
    expect(() => span(1, 2).pad(-2)).toThrow(/pad\(\) needs a length/);
  });
});

describe(".to(values, span)", () => {
  test("moves the cursor to the span and takes its length, like at() then to()", () => {
    const viaSpan = scene(rect(motion({ x: 0 }).to({ x: 50 }, span(2, 3), ease.linear)));
    const viaChain = scene(rect(motion({ x: 0 }).at(2).to({ x: 50 }, 3, ease.linear)));
    const literal = scene(rect(motion({ x: 0 }).to({ x: 50 }, { at: 2, over: 3 }, ease.linear)));

    expect(viaSpan).toBe(viaChain);
    expect(literal).toBe(viaChain);
  });

  test("a span without over has no length to take", () => {
    // @ts-expect-error an open span has no over, so `to` rejects it
    expect(() => motion({ x: 0 }).to({ x: 5 }, span(2))).toThrow(/needs a span with an over/);
  });
});

describe("<Clip>", () => {
  const slide = motion({ x: 0 }).to({ x: 50 }, 2, ease.linear);

  test("draws nothing, and a clip at 0 changes no byte", () => {
    expect(scene(<Clip at={0}>{rect(slide)}</Clip>)).toBe(scene(rect(slide)));
  });

  test("starts the clock of every motion inside at its at", () => {
    const svg = scene(
      <Clip at={3}>
        <g>{rect(slide)}</g>
      </Clip>,
    );

    expect(keys(svg, "translate")).toEqual([
      { t: 0, value: 0 },
      { t: 3, value: 0 },
      { t: 5, value: 50 },
      { t: 10, value: 50 },
    ]);
  });

  test("clips inside clips add up, and the same clock reaches elements nested in elements", () => {
    const nested = scene(
      <Clip at={1}>
        <g>
          <Clip at={2}>{rect(slide)}</Clip>
        </g>
      </Clip>,
    );

    const flat = scene(
      <g>
        <Clip at={3}>{rect(slide)}</Clip>
      </g>,
    );

    expect(nested).toBe(flat);
  });

  test("a clip's own clock is its own: two siblings both start from their at", () => {
    const svg = scene(
      <>
        <Clip at={1}>{rect(slide)}</Clip>
        <Clip at={4}>{rect(slide)}</Clip>
      </>,
    );

    const times = [...svg.matchAll(/@keyframes [\w-]+\{(.*)\}$/gm)].map((match) => match[1]);

    expect(times).toHaveLength(2);
    expect(times[0]).toContain("10%");
    expect(times[1]).toContain("40%");
  });

  test("before it starts a motion holds its first value, and after it ends its last", () => {
    const svg = scene(<Clip at={4}>{rect(slide)}</Clip>);
    const held = keys(svg, "translate");

    expect(held.at(0)).toEqual({ t: 0, value: 0 });
    expect(held.at(-1)).toEqual({ t: 10, value: 50 });
  });

  test("a motion past the clip's over throws, naming the clip", () => {
    expect(() =>
      scene(
        <Clip at={3} over={1}>
          {rect(slide)}
        </Clip>,
      ),
    ).toThrow("A motion on <rect> runs until 2s, past the 1s <Clip at={3} over={1}>.");
  });

  test("a motion past the scene throws, naming the clip it sits in", () => {
    expect(() => scene(<Clip at={9}>{rect(slide)}</Clip>)).toThrow(
      "A motion on <rect> runs until 11s (2s into <Clip at={9}>), past the 10s scene.",
    );

    expect(() => scene(rect(motion({ x: 0 }).at(9).to({ x: 5 }, 2)))).toThrow(
      "A motion on <rect> runs until 11s, past the 10s scene.",
    );
  });

  test("a clip longer than the clip or scene around it throws", () => {
    expect(() => scene(<Clip at={8} over={3} />)).toThrow(
      "A <Clip at={8} over={3}> runs until 11s, past the 10s scene.",
    );

    expect(() =>
      scene(
        <Clip at={2} over={4}>
          <Clip at={3} over={2} />
        </Clip>,
      ),
    ).toThrow("A <Clip at={3} over={2}> runs until 5s, past the 4s <Clip at={2} over={4}>.");

    expect(() => scene(<Clip at={11} />)).toThrow(/<Clip at=\{11\}> runs until/);
  });

  test("an open clip runs to the end of the clip around it, so a motion past that throws there", () => {
    expect(() =>
      scene(
        <Clip at={2} over={4}>
          <Clip at={1}>{rect(motion({ x: 0 }).to({ x: 5 }, 4))}</Clip>
        </Clip>,
      ),
    ).toThrow("A motion on <rect> runs until 5s, past the 4s <Clip at={2} over={4}>.");
  });

  test("takes a positive length and a start of 0 or later", () => {
    expect(() => <Clip at={-1} />).toThrow(/at of 0 or later/);
    expect(() => <Clip at={1} over={0} />).toThrow(/positive over/);
  });

  test("a def with motions plays on the clock of the clip that uses it", () => {
    const blur = def.filter(
      {},
      <feGaussianBlur
        stdDeviation={0}
        animation={motion({ stdDeviation: 0 }).to({ stdDeviation: 4 }, 1)}
      />,
    );

    const at = (t: number) => (
      <Clip at={t}>
        <rect width={10} height={10} filter={blur} />
      </Clip>
    );

    const svg = scene(
      <>
        {at(0)}
        {at(3)}
      </>,
    );

    const begins = [...svg.matchAll(/keyTimes="([^"]*)"/g)].map((match) => match[1]);

    expect([...svg.matchAll(/<filter /g)]).toHaveLength(2);
    expect(begins[0]).toBe("0;0.1;1");
    expect(begins[1]).toBe("0;0.3;0.4;1");
  });

  test("works inside <Once>", () => {
    expect(
      scene(
        <Once>
          <Clip at={2}>{rect(slide)}</Clip>
        </Once>,
      ),
    ).toContain("translate");
  });
});

describe(".repeat()", () => {
  const spin = motion({ rotate: 0 }).to({ rotate: 360 }, 2, ease.linear);

  test("a count plays the passage that many times, each from the initial values", () => {
    const svg = scene(rect(spin.repeat(3)));

    expect(keys(svg, "rotate")).toEqual([
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
    expect(scene(rect(spin.repeat(1)))).toBe(scene(rect(spin)));
  });

  test("the passage runs from its first transition to the cursor, so a wait is part of it", () => {
    const svg = scene(rect(motion({ x: 0 }).at(1).to({ x: 10 }, 1, ease.linear).wait(1).repeat(2)));

    expect(keys(svg, "translate").map((key) => key.t)).toEqual([0, 1, 2, 3, 4, 10]);
  });

  test("a passage that ends where it began restarts without a cut", () => {
    const svg = scene(
      rect(motion({ x: 0 }).to({ x: 10 }, 1, ease.linear).to({ x: 0 }, 1, ease.linear).repeat(3)),
    );

    expect(keys(svg, "translate").map((key) => key.value)).toEqual([0, 10, 0, 10, 0, 10, 0, 0]);
  });

  test("until repeats to that time, cutting the last pass short, and holds the value it reached", () => {
    const svg = scene(rect(spin.repeat({ until: 7 })));
    const held = keys(svg, "rotate");

    expect(held.at(-2)).toEqual({ t: 7, value: 180 });
    expect(held.at(-1)).toEqual({ t: 10, value: 180 });
    expect(held.filter((key) => key.value === 360)).toHaveLength(3);
  });

  test("until on a pass boundary plays whole passes", () => {
    const svg = scene(rect(spin.repeat({ until: 6 })));

    expect(keys(svg, "rotate").at(-2)).toEqual({ t: 6, value: 360 });
    expect(scene(rect(spin.repeat({ until: 6 })))).toBe(scene(rect(spin.repeat(3))));
  });

  test("a transition cut partway ends on the value the whole transition passed through there", () => {
    const svg = scene(rect(motion({ x: 0 }).to({ x: 100 }, 2, ease.out).repeat({ until: 3 })));
    const held = keys(svg, "translate");

    expect(held.at(-2)?.t).toBe(3);
    expect(held.at(-2)?.value).toBeCloseTo(100 * easeAt(ease.out, 0.5), 2);
  });

  test("a cut transition keeps the shape of the curve, not a straight line to the cut", () => {
    const svg = scene(
      rect(motion({ x: 0 }).to({ x: 100 }, 2, ease.inOut).repeat({ until: 3 })),
      10,
    );

    // The cut pass runs 2s to 3s: the lane's own timing function is the head of inOut, not inOut itself.
    expect(svg).toMatch(/cubic-bezier\(/);
    expect(svg).not.toContain("cubic-bezier(.77,0,.175,1);animation-timing-function:linear");
  });

  test("a later step may follow the repeat", () => {
    const svg = scene(rect(spin.repeat({ until: 4 }).at(5).to({ rotate: 90 }, 1, ease.linear)));

    expect(keys(svg, "rotate").at(-2)).toEqual({ t: 6, value: 90 });
  });

  test("two channels restart together, each from its own initial value", () => {
    const svg = scene(
      rect(motion({ x: 5, opacity: 0.5 }).to({ x: 25, opacity: 1 }, 1, ease.linear).repeat(2)),
    );

    expect(keys(svg, "translate").map((key) => key.value)).toEqual([5, 25, 5, 25, 25]);
    expect(keys(svg, "opacity").map((key) => key.value)).toEqual([0.5, 1, 0.5, 1, 1]);
  });

  test("asks for a whole number of plays, a passage, a length and an until after the passage", () => {
    expect(() => spin.repeat(0)).toThrow(/whole number of plays/);
    expect(() => spin.repeat(1.5)).toThrow(/whole number of plays/);
    expect(() => motion({ x: 0 }).repeat(2)).toThrow(/needs a passage to repeat/);
    expect(() => motion({ x: 0 }).set({ x: 5 }).repeat(2)).toThrow(/needs a passage with a length/);
    expect(() => spin.repeat({ until: 2 })).toThrow(/needs a time after the passage ends, at 2s/);
    expect(() => spin.repeat({ until: Infinity })).toThrow(/finite until/);
  });

  test("a runaway count fails before it unrolls, and a lane past its key cap says why", () => {
    expect(() => spin.repeat(100000)).toThrow(/would unroll 100000 passes/);
    expect(() =>
      render(
        { width: 10, height: 10, title: "t", duration: 3000 },
        rect(motion({ x: 0 }).to({ x: 1 }, 1, ease.linear).repeat(1500)),
      ),
    ).toThrow(
      /has 3\d{3} keys; the cap is 2000. repeat\(\) unrolls every pass, so use .loop\(period\)/,
    );
  });

  test("stopping a steps() transition off a step edge throws, and on one it cuts cleanly", () => {
    const stepped = motion({ x: 0 }).to({ x: 100 }, 2, ease.steps(4));

    expect(() => scene(rect(stepped.repeat({ until: 3.2 })))).toThrow(
      /repeat\(\{ until \}\) cuts a steps\(4\) transition between two of its steps/,
    );
    const svg = scene(rect(stepped.repeat({ until: 3 })));

    expect(keys(svg, "translate").at(-2)).toEqual({ t: 3, value: 50 });
  });

  test("stopping a colour transition partway throws, but a colour that holds there is fine", () => {
    const tint = motion({ fill: "#000000" }).to({ fill: "#ffffff" }, 2, ease.linear);

    expect(() =>
      scene(<rect width={10} height={10} animation={tint.repeat({ until: 3 })} />),
    ).toThrow(/stops fill partway/);
    expect(scene(<rect width={10} height={10} animation={tint.repeat({ until: 4 })} />)).toContain(
      "fill",
    );
  });

  test("nothing follows rewind(), and a repeat can't follow it", () => {
    const rewound = motion({ x: 0 }).to({ x: 10 }, 1).rewind(1);

    expect(() => rewound.repeat(2)).toThrow(/can't follow rewind/);
    expect(() => rewound.to({ x: 1 }, 1)).toThrow(/can't follow rewind/);
    expect(() => rewound.rewind(1)).toThrow(/can't follow rewind/);
  });

  test("a repeat inside a clip repeats on the clip's clock", () => {
    const svg = scene(<Clip at={2}>{rect(spin.repeat(2))}</Clip>);

    expect(keys(svg, "rotate").map((key) => key.t)).toEqual([0, 2, 4, 4.0001, 6, 10]);
  });

  test("a loop shorter than the repeated passages throws", () => {
    expect(() => spin.repeat(3).loop(5)).toThrow(/shorter than the motion/);
  });
});

describe(".rewind()", () => {
  const out = motion({ x: 0 }).to({ x: 50 }, 2, ease.linear);

  test("glides every channel back to its initial value, ending at the scene's end", () => {
    expect(keys(scene(rect(out.rewind(1))), "translate")).toEqual([
      { t: 0, value: 0 },
      { t: 2, value: 50 },
      { t: 9, value: 50 },
      { t: 10, value: 0 },
    ]);
  });

  test("ends at the clip's end, whose length it takes from over, or the scene's end when open", () => {
    const closed = scene(
      <Clip at={2} over={4}>
        {rect(out.rewind(1))}
      </Clip>,
    );

    const open = scene(<Clip at={2}>{rect(out.rewind(1))}</Clip>);

    expect(keys(closed, "translate").at(-3)).toEqual({ t: 5, value: 50 });
    expect(keys(closed, "translate").at(-2)).toEqual({ t: 6, value: 0 });
    expect(keys(open, "translate").at(-2)).toEqual({ t: 9, value: 50 });
    expect(keys(open, "translate").at(-1)).toEqual({ t: 10, value: 0 });
  });

  test("a loop's clock ends at its period, so the loop closes", () => {
    const svg = scene(rect(out.loop(5).rewind(1)));
    const held = keys(svg, "translate", 5);

    expect(held.at(0)).toEqual({ t: 0, value: 0 });
    expect(held.at(-1)).toEqual({ t: 5, value: 0 });
    expect(held.at(-2)).toEqual({ t: 4, value: 50 });
  });

  test("adds nothing to a motion that is already home, and uses the ease it is given", () => {
    const home = motion({ x: 0 }).to({ x: 5 }, 1).to({ x: 0 }, 1);

    expect(scene(rect(home.rewind(1)))).toBe(scene(rect(home)));
    expect(scene(rect(out.rewind(1, ease.linear)))).not.toBe(scene(rect(out.rewind(1))));
  });

  test("needs the room: a motion still running when the rewind must start throws", () => {
    expect(() => scene(rect(motion({ x: 0 }).at(8).to({ x: 9 }, 1.5).rewind(1)))).toThrow(
      /rewind\(1\) on <rect> needs the last 1s of its 10s clock, but the motion runs until 9.5s/,
    );
  });

  test("restores a channel that began as an attribute", () => {
    const svg = scene(
      <rect
        width={10}
        height={10}
        fill="#123"
        animation={motion().to({ fill: "#fff" }, 1).rewind(1)}
      />,
    );

    expect(svg).toContain("0%,100%{fill:#123}");
  });
});

describe(".loop() inside a clip", () => {
  const P = 5;
  const spin = motion({ rotate: 0 }).to({ rotate: 360 }, 2, ease.linear).loop(P);

  test("only changes the phase: the loop starts counting where the clip starts", () => {
    const svg = scene(<Clip at={2.5}>{rect(spin)}</Clip>);
    const held = keys(svg, "rotate", P);

    expect(held).toEqual([
      { t: 0, value: 360 },
      { t: 2.49995, value: 360 },
      { t: 2.5, value: 0 },
      { t: 4.5, value: 360 },
      { t: 5, value: 360 },
    ]);
  });

  test("a clip starting a whole period in changes nothing", () => {
    expect(scene(<Clip at={5}>{rect(spin)}</Clip>)).toBe(scene(rect(spin)));
  });

  test("a loop starting inside its own glide splits it into two glides that join", () => {
    const svg = scene(<Clip at={1}>{rect(spin)}</Clip>);
    const held = keys(svg, "rotate", P);

    // The loop starts at 1: the glide runs 1 to 3, and before 1 the loop is on the end of its last pass.
    expect(held.at(0)).toEqual({ t: 0, value: 360 });
    expect(held.find((key) => Math.abs(key.t - 1) < 1e-3 && key.value === 0)).toBeDefined();
    expect(held.find((key) => key.t === 3)?.value).toBe(360);
  });

  test("rotating keys draws what the unrotated keys draw, whichever ease crosses the wrap", () => {
    const eases = [ease.linear, ease.out, ease.inOut, ease.pop, ease.in];

    for (const curve of eases) {
      const original = keysOf({ x: 0 }, [{ start: 1, over: 3, ease: curve, values: { x: 80 } }], 6);

      for (const shift of [0.5, 1.7, 2.5, 3.9, 5.2]) {
        const rotated = rotateKeys(original, shift, 6, "test");

        for (let t = 0; t <= 6; t += 0.07) {
          const want = Number(valueAt(original, (((t - shift) % 6) + 6) % 6).x);
          // A glide that is cut also moves its key one nudge early, so allow the width of a nudge.
          const got = Number(valueAt(rotated, t).x);

          expect(Math.abs(got - want)).toBeLessThan(0.08 + Math.abs(want) * 0.002);
        }
      }
    }
  });

  test("a steps() transition cut off a step edge by the phase throws; on an edge it rotates", () => {
    const original = keysOf(
      { x: 0 },
      [{ start: 0, over: 4, ease: ease.steps(4), values: { x: 40 } }],
      6,
    );

    expect(() => rotateKeys(original, 6 - 1.5, 6, "A loop")).toThrow(
      /cuts a steps\(4\) transition/,
    );
    expect(() => rotateKeys(original, 6 - 2, 6, "A loop")).not.toThrow();
  });

  test("a colour mid-glide at the wrap can't be split", () => {
    const original = keysOf(
      { fill: "#000000" },
      [{ start: 1, over: 3, ease: ease.linear, values: { fill: "#ffffff" } }],
      6,
    );

    expect(() => rotateKeys(original, 6 - 2, 6, "A loop")).toThrow(/stops fill partway/);
  });
});

describe("clips, loops and repeats together", () => {
  const spin = motion({ rotate: 0 }).to({ rotate: 360 }, 2, ease.linear).loop(5);

  test("a loop inside nested clips takes the sum of their starts as its phase", () => {
    const nested = scene(
      <Clip at={1}>
        <Clip at={1.5}>{rect(spin)}</Clip>
      </Clip>,
    );

    expect(nested).toBe(scene(<Clip at={2.5}>{rect(spin)}</Clip>));
  });

  test("a repeat that stops mid-pass moves every channel it touches to where that pass had got", () => {
    const both = motion({ x: 0, opacity: 0 })
      .to({ x: 100, opacity: 1 }, 2, ease.linear)
      .repeat({ until: 5 });

    const svg = scene(rect(both));

    expect(keys(svg, "translate").at(-2)).toEqual({ t: 5, value: 50 });
    expect(keys(svg, "opacity").at(-2)).toEqual({ t: 5, value: 0.5 });
  });

  test("a repeat of a path morph can stop partway too", () => {
    // SAFETY: both literals start with M, as PathData requires.
    const [from, to] = ["M0 0L10 0", "M0 0L30 0"] as [`M${string}`, `M${string}`];
    const morph = motion({ d: from }).to({ d: to }, 2, ease.linear);

    const svg = scene(<path d="M0 0L10 0" animation={morph.repeat({ until: 3 })} />);

    expect(svg).toContain("M0 0L20 0");
  });

  test("a repeat inside a clip that has an over ends within it", () => {
    expect(() =>
      scene(
        <Clip at={1} over={3}>
          {rect(motion({ x: 0 }).to({ x: 1 }, 2).repeat(2))}
        </Clip>,
      ),
    ).toThrow("A motion on <rect> runs until 4s, past the 3s <Clip at={1} over={3}>.");
  });
});

describe("show()", () => {
  const fade = (spans: Parameters<typeof show>[0], options?: Parameters<typeof show>[1]) =>
    keys(scene(rect(show(spans, options))), "opacity");

  test("fades in over the first fade of the span and out over the last, inside it", () => {
    expect(fade(span(2, 4))).toEqual([
      { t: 0, value: 0 },
      { t: 2, value: 0 },
      { t: 2.3, value: 1 },
      { t: 5.7, value: 1 },
      { t: 6, value: 0 },
      { t: 10, value: 0 },
    ]);
    expect(fade(span(2, 4), { fade: 0.5 }).map((key) => key.t)).toEqual([0, 2, 2.5, 5.5, 6, 10]);
  });

  test("a span shorter than two fades shrinks them", () => {
    expect(fade(span(2, 0.4)).map((key) => key.t)).toEqual([0, 2, 2.2, 2.4, 10]);
  });

  test("overlapping and touching spans merge, in any order, so fades never collide", () => {
    const merged = fade([span(5, 2), span(1, 2), span(2, 2), span(7, 1)]).map((key) => key.t);

    expect(merged).toEqual([0, 1, 1.3, 3.7, 4, 5, 5.3, 7.7, 8, 10]);
    expect(fade([span(1, 2), span(3, 1)]).map((key) => key.t)).toEqual([0, 1, 1.3, 3.7, 4, 10]);
    expect(fade([span(1, 2), span(3.1, 1)]).map((key) => key.t)).toEqual([
      0, 1, 1.3, 2.7, 3, 3.1, 3.4, 3.8, 4.1, 10,
    ]);
  });

  test("fade: 0 cuts, and a cut on a whole scene is a visibility toggle", () => {
    const svg = scene(rect(show(span(2, 3), { fade: 0 })));

    expect(svg).toContain("visibility:hidden");
    expect(svg).toContain("visibility:visible");
    expect(scene(rect(show([span(0, 2), span(4, 1)], { fade: 0 })))).not.toContain("opacity:");
  });

  test("an open span fades in and holds to the end, even past other spans", () => {
    expect(fade({ at: 4 }).map((key) => key.t)).toEqual([0, 4, 4.3, 10]);
    expect(fade({ at: 4 }).at(-1)?.value).toBe(1);
    expect(fade([span(1, 2), { at: 2 }]).map((key) => key.t)).toEqual([0, 1, 1.3, 10]);
    expect(fade([{ at: 6 }, span(1, 1)]).map((key) => key.t)).toEqual([
      0, 1, 1.3, 1.7, 2, 6, 6.3, 10,
    ]);
  });

  test("inside a clip an open span holds to the clip's end, and the scene end otherwise", () => {
    const svg = scene(
      <Clip at={3} over={4}>
        {rect(show({ at: 1 }))}
      </Clip>,
    );

    expect(keys(svg, "opacity").at(-1)).toEqual({ t: 10, value: 1 });
  });

  test("takes a span, a list, a plain literal; asks for something to show and a fade of 0 or more", () => {
    expect(scene(rect(show({ at: 2, over: 3 })))).toBe(scene(rect(show(span(2, 3)))));
    expect(scene(rect(show([])))).toBe(scene(rect(motion({ opacity: 0 }))));
    expect(() => show(span(1, 2), { fade: -1 })).toThrow(/fade of 0 or more/);
    expect(() => show({ at: -1, over: 2 })).toThrow(/start of 0 or later/);
    expect(() => show({ at: 1, over: 0 })).toThrow(/positive over/);
  });

  test("during and cut are show with a fade and with none, and timeline's show and enter still work", () => {
    expect(scene(rect(during(span(2, 4), 0.5)))).toBe(scene(rect(show(span(2, 4), { fade: 0.5 }))));
    expect(scene(rect(cut(span(2, 4))))).toBe(scene(rect(show(span(2, 4), { fade: 0 }))));
    const tl = timeline({ a: 3, b: 4 });

    expect(scene(rect(tl.show("b")))).toBe(scene(rect(show(tl.b))));
    expect(tl.b.next(2).at).toBe(7);
    expect(keys(scene(rect(tl.enter("b"))), "opacity").at(-1)?.value).toBe(1);
  });
});

describe("sampled() with a window", () => {
  const line = (options: { at?: number; over: number }) =>
    sampled((t) => ({ x: t * 10 }), { ...options, tolerance: { translate: 0.01 } });

  test("plays from at, hands the function time from 0 to over, and holds either side", () => {
    const seen: number[] = [];

    const motionOf = sampled(
      (t) => {
        seen.push(t);

        return { x: t * 10 };
      },
      { at: 4, over: 2, tolerance: { translate: 0.01 } },
    );

    const held = keys(scene(rect(motionOf)), "translate");

    expect(Math.min(...seen)).toBe(0);
    expect(Math.max(...seen)).toBe(2);
    expect(held[0]).toEqual({ t: 0, value: 0 });
    expect(held.at(-1)).toEqual({ t: 10, value: 20 });
    expect(held.find((key) => key.value === 0 && key.t > 0)?.t).toBe(4);
    expect(held.find((key) => key.value === 20)?.t).toBe(6);
  });

  test("without at it starts at 0, and duration is the same as over", () => {
    const viaOver = scene(rect(line({ over: 4 })));

    const viaDuration = scene(
      rect(sampled((t) => ({ x: t * 10 }), { duration: 4, tolerance: { translate: 0.01 } })),
    );

    expect(viaDuration).toBe(viaOver);
  });

  test("asks for a positive over and an at of 0 or later", () => {
    expect(() => line({ over: 0 })).toThrow(/sampled\(\) needs a positive over, got 0/);
    expect(() => line({ at: -1, over: 2 })).toThrow(/at of 0 or later/);
    // @ts-expect-error neither over nor duration
    expect(() => sampled((t) => ({ x: t }), { tolerance: { translate: 0.1 } })).toThrow(
      /positive over/,
    );
  });

  test("sampled.path takes the same window", () => {
    // SAFETY: the template starts with M, as PathData requires.
    const frame = (t: number) => `M0 0L${10 + t} 0` as `M${string}`;
    const path = sampled.path(frame, { at: 2, over: 3, tolerance: 0.1 });

    const svg = scene(<path d={frame(0)} animation={path} />);

    expect(svg).toContain('keyTimes="0;0.2;0.5;1"');
  });
});

describe("results return a span", () => {
  test("typewriter, terminal, reveal and flow say when they run, and end stays as the span's end", () => {
    const typed = typewriter(code("ab\ncd"), { at: 1, cps: 10 });
    const shell = terminal([{ cmd: "ls", output: ["a"] }, { cmd: "pwd" }], { at: 2 });
    const blocks = reveal(code("a\n\nb"), { at: 3, over: 0.5 });

    const trip = flow(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      { at: 4, over: 2, arrive: true },
    );

    expect([typed.span.at, typed.span.end]).toEqual([1, typed.end]);
    expect([shell.span.at, shell.span.end]).toEqual([2, shell.end]);
    expect([blocks.span.at, blocks.span.end]).toEqual([3, blocks.end]);
    expect([trip.span.at, trip.span.end]).toEqual([4, trip.end]);
    expect(trip.span.end).toBeCloseTo(6.7, 9);
    expect(typed.span.next(1, 0.5).at).toBeCloseTo(typed.end + 0.5, 9);
  });
});

describe("one clock in the tools", () => {
  const faster = (rate: number) =>
    render(
      { width: 10, height: 10, title: "Test", duration: 4, playbackRate: rate },
      rect(motion({ x: 0 }).to({ x: 4 }, 4, ease.linear)),
    );

  test("a scene played at another rate says so on its root, and one at rate 1 stays as it was", () => {
    expect(faster(2)).toContain('data-playback-rate="2"');
    expect(faster(1)).not.toContain("data-playback-rate");
  });

  test("restyle starts a copy at scene seconds, whatever the rate", () => {
    expect(restyle(faster(1), { at: 2 })).toContain("--t0:-2s");
    expect(restyle(faster(2), { at: 2 })).toContain("--t0:-1s");
    expect(restyle(faster(2), { at: 2, onceAt: 0.5 })).toContain("--t0:-1s;--t1:-0.25s");
  });
});
