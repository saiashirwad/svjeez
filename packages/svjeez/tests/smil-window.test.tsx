import { describe, expect, test } from "bun:test";
import { ease, motion, render } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { restyle } from "svjeez/page";

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

const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

const A = "M0 0L20 0L20 20L0 20Z";
const B = "M4 4L16 4L16 16L4 16Z";
const size = { width: 20, height: 20, title: "Window" };
const attrsOf = (svg: string, tag: string) => svg.match(new RegExp(`<${tag}\\b[^>]*>`, "g")) ?? [];

/** A morph that rests on A, runs to B and stays there for the rest of a 10 second loop. */
const morph = render(
  { ...size, duration: 10 },
  <path d={A} fill="red" animation={motion({ d: A }).at(2).to({ d: B }, 1, ease.linear)} />,
);

/** A morph that returns to where it started. */
const there = render(
  { ...size, duration: 10 },
  <path
    d={A}
    fill="red"
    animation={motion({ d: A })
      .at(2)
      .to({ d: B }, 1, ease.linear)
      .at(8)
      .to({ d: A }, 1, ease.linear)}
  />,
);

const blur = render(
  { ...size, duration: 10, playbackRate: 2 },
  <g animation={motion({ blur: 6 }).at(1).to({ blur: 0 }, 2, ease.linear)}>
    <rect width={9} height={9} />
  </g>,
);

/** The same scene with the plain looping `<animate>` the compiler used to write. */
const plain = (svg: string, values: string, keyTimes: string, dur: string, attribute = "d") =>
  svg.replace(
    /<animate id="[^"]*"[^>]*\/>(?:\s*<set[^>]*\/>)*/,
    `<animate attributeName="${attribute}" values="${values}" keyTimes="${keyTimes}" dur="${dur}" repeatCount="indefinite"/>`,
  );

const morphPlain = plain(morph, `${A};${A};${B};${B}`, "0;0.2;0.3;1", "10s");
const therePlain = plain(there, `${A};${A};${B};${B};${A};${A}`, "0;0.2;0.3;0.8;0.9;1", "10s");
const blurPlain = plain(blur, "6;6;0;0", "0;0.1;0.3;1", "5s", "stdDeviation");

describe("windowed SMIL markup", () => {
  test("a morph that holds most of the loop animates only while it moves", () => {
    const [animate] = attrsOf(morph, "animate");
    expect(animate).toContain(`values="${A};${B}"`);
    expect(animate).toContain('keyTimes="0;1"');
    expect(animate).toContain('begin="2s;w1.begin+10s"');
    expect(animate).toContain('dur="1s"');
    expect(animate).toContain('fill="freeze"');
    expect(animate).not.toContain("repeatCount");
    // Past the window it holds B, so the next loop's start resets to A.
    expect(attrsOf(morph, "set")).toEqual([
      `<set attributeName="d" to="${A}" begin="0s;w1.begin+8s" dur="2s" fill="freeze" data-loop="10s"/>`,
    ]);
  });

  test("a morph that ends where it began needs no reset", () => {
    expect(attrsOf(there, "set")).toHaveLength(1);
    expect(attrsOf(there, "animate")[0]).toContain('begin="2s;w1.begin+10s" dur="7s"');
    expect(attrsOf(there, "animate")[0]).toContain('keyTimes="0;0.14286;0.85714;1"');
  });

  test("the element holds the last value and the reduced-motion twin keeps the still frame", () => {
    const svg = render(
      { ...size, duration: 10, reducedMotion: { at: 0.5 } },
      <path d={A} animation={motion({ d: A }).at(2).to({ d: B }, 1, ease.linear)} />,
    );

    expect(svg).toContain(`<path d="${B}" class="dm">`);
    expect(svg).toContain(`<path d="${A}" class="ds" display="none"/>`);

    const filter = render(
      { ...size, duration: 10, reducedMotion: { at: 0.5 } },
      <g animation={motion({ blur: 6 }).at(2).to({ blur: 0 }, 1, ease.linear)} />,
    );

    expect(filter).toContain('<feGaussianBlur stdDeviation="0">');
    expect(filter).toContain('<feGaussianBlur stdDeviation="6"/>');
  });

  test("blur windows at playback speed", () => {
    expect(attrsOf(blur, "animate")[0]).toContain('begin="0.5s;w1.begin+5s" dur="1s"');
    expect(attrsOf(blur, "set")[0]).toContain('to="6" begin="0s;w1.begin+4.5s" dur="0.5s"');
  });

  test("ids carry the prefix and stay unique", () => {
    const svg = render(
      { ...size, duration: 10, prefix: "x" },
      <>
        <path d={A} animation={motion({ d: A }).at(2).to({ d: B }, 1, ease.linear)} />
        <path d={A} animation={motion({ d: A }).at(3).to({ d: B }, 1, ease.linear)} />
      </>,
    );

    const ids = [...svg.matchAll(/ id="([^"]*)"/g)].map((match) => match[1]);
    expect(ids.filter((id) => id?.startsWith("xw"))).toEqual(["xw1", "xw2"]);
    expect(svg).toContain("xw2.begin+10s");
  });

  test("a motion that fills the loop is left as it was", () => {
    const svg = render(
      { ...size, duration: 10 },
      <path d={A} animation={motion({ d: A }).at(1).to({ d: B }, 8, ease.linear)} />,
    );

    expect(attrsOf(svg, "animate")[0]).toContain('repeatCount="indefinite"');
    expect(svg).not.toContain("<set");
  });

  test("loop: false and Once keep the plain animate", () => {
    const still = render(
      { ...size, duration: 10, loop: false },
      <path d={A} animation={motion({ d: A }).at(2).to({ d: B }, 1, ease.linear)} />,
    );

    expect(attrsOf(still, "animate")[0]).not.toContain("w1");
    expect(attrsOf(still, "animate")[0]).toContain("repeatCount=");
  });
});

describe.if(browser)("windowed SMIL renders as the plain animate did", () => {
  const times = [0, 1.5, 2.5, 2.99, 5, 9.5, 10, 11.5, 12.5, 15, 19.9, 21.5, 22.5, 25];

  const check = (name: string, windowed: string, reference: string, at = times) =>
    test(name, async () => {
      const [a, b] = await Promise.all([
        renderFrames(windowed, { times: at }),
        renderFrames(reference, { times: at }),
      ]);

      at.forEach((time, index) => {
        expect(same(a.frames[index]!.png, b.frames[index]!.png), `at ${time}s`).toBe(true);
      });

      // The scene moves, so the check compares pictures that differ.
      expect(a.frames.some((frame) => !same(frame.png, a.frames[0]!.png))).toBe(true);
    });

  check("a morph that resets at the top of the loop", morph, morphPlain);
  check("a morph that comes back", there, therePlain);

  // Loops 2 and 3 only: the merged set resets the first value at each loop start.
  check(
    "the merged set resets each later loop",
    morph,
    morphPlain,
    [10, 10.5, 11.9, 12.5, 15, 20, 20.5, 21.9, 22.5, 29.9],
  );

  // Scene seconds at twice the speed: the loop is 10 scene seconds, 5 played.
  check(
    "blur on a scene played faster",
    blur,
    blurPlain,
    [0, 0.5, 1.5, 2.5, 3, 5, 9.5, 10, 11.5, 12.5, 21],
  );

  test("restyle holds and starts the windowed morph where the plain one does", async () => {
    for (const at of [1, 2.5, 6, 11, 12.5]) {
      for (const paused of [true, false]) {
        const options = { at, paused };
        // A copy started `at` seconds in shows, `later` seconds on, what the scene shows at `at + later`.
        const later = paused ? [0, 3] : [0, 0.25, 3, 7];

        const [a, b] = await Promise.all([
          renderFrames(restyle(morph, options), { times: later }),
          renderFrames(restyle(morphPlain, options), { times: later }),
        ]);

        later.forEach((time, index) => {
          expect(
            same(a.frames[index]!.png, b.frames[index]!.png),
            `restyle at ${at}, paused ${paused}, +${time}s`,
          ).toBe(true);
        });
      }
    }
  });
});
