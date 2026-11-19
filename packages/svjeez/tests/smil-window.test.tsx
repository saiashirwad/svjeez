import { describe, expect, test } from "bun:test";
import { renderFrames } from "svjeez/frames";
import { restyle } from "svjeez/page";
import { Shape, blur, ease, path, rect, scene, span, track, type SceneElement } from "svjeez";
import { svg, type SceneOptions, type SvgOptions } from "svjeez/tools";

const emit = (
  build: () => SceneElement,
  options: Partial<SceneOptions> = {},
  output: SvgOptions = {},
): string =>
  svg.emit(scene({ size: [20, 20], duration: 10, title: "Window", ...options }, build), output);

const browser = await renderFrames(
  emit(() => <Shape geometry={rect(4, 4)} fill="#000000" />, { duration: 1 }),
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

const attrsOf = (out: string, tag: string) => out.match(new RegExp(`<${tag}\\b[^>]*>`, "g")) ?? [];

const square = path.parse("M0 0L20 0L20 20L0 20Z");
const inner = path.parse("M4 4L16 4L16 16L4 16Z");

const morphing = (when = span(2, 1)) => (
  <Shape geometry={track(square).to(inner, when, ease.linear)} fill="#FF0000" />
);

const morph = emit(() => morphing());

const [, A = "", B = ""] = /values="([^";]*);([^";]*)"/.exec(morph) ?? [];

const there = emit(() => (
  <Shape
    geometry={track(square).to(inner, span(2, 1), ease.linear).to(square, span(8, 1), ease.linear)}
    fill="#FF0000"
  />
));

const blurring = () => (
  <Shape
    geometry={rect(9, 9)}
    fill="#000000"
    effects={[blur(track(6).to(0, span(1, 2), ease.linear))]}
  />
);

const blurred = emit(blurring, {}, { playbackRate: 2 });

const plain = (out: string, values: string, keyTimes: string, dur: string, attribute = "d") =>
  out.replace(
    /<animate id="[^"]*"[^>]*\/>(?:\s*<set[^>]*\/>)*/,
    `<animate attributeName="${attribute}" values="${values}" keyTimes="${keyTimes}" dur="${dur}" repeatCount="indefinite"/>`,
  );

const absolute = (out: string) =>
  out.replaceAll(A, "M0 0L20 0L20 20L0 20Z").replaceAll(B, "M4 4L16 4L16 16L4 16Z");

const [a, b] = ["M0 0L20 0L20 20L0 20Z", "M4 4L16 4L16 16L4 16Z"];
const morphFramed = absolute(morph);
const thereFramed = absolute(there);

const morphPlain = plain(morphFramed, `${a};${a};${b};${b}`, "0;0.2;0.3;1", "10s");

const therePlain = plain(
  thereFramed,
  `${a};${a};${b};${b};${a};${a}`,
  "0;0.2;0.3;0.8;0.9;1",
  "10s",
);

const blurPlain = plain(blurred, "6;6;0;0", "0;0.1;0.3;1", "5s", "stdDeviation");

describe("windowed SMIL markup", () => {
  test("a morph that holds most of the loop animates only while it moves", () => {
    const [animate] = attrsOf(morph, "animate");

    expect(animate).toContain(`values="${A};${B}"`);
    expect(animate).toContain('keyTimes="0;1"');
    expect(animate).toContain('begin="2s;w1.begin+10s"');
    expect(animate).toContain('dur="1s"');
    expect(animate).toContain('fill="freeze"');
    expect(animate).not.toContain("repeatCount");
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
    const out = emit(() => morphing(), { still: 0.5 });

    expect(out).toMatch(new RegExp(`<path d="${B}"[^>]* class="dm">`));
    expect(out).toMatch(new RegExp(`<path d="${A}"[^>]* class="ds" display="none"/>`));

    const filter = emit(blurring, { still: 0.5 });

    expect(filter).toContain('<feGaussianBlur stdDeviation="0">');
    expect(filter).toContain('<feGaussianBlur stdDeviation="6"/>');
  });

  test("blur windows at playback speed", () => {
    expect(attrsOf(blurred, "animate")[0]).toContain('begin="0.5s;s1.begin+5s" dur="1s"');
    expect(attrsOf(blurred, "set")[0]).toContain('to="6" begin="0s;s1.begin+4.5s" dur="0.5s"');
  });

  test("ids carry the prefix and stay unique", () => {
    const out = emit(
      () => (
        <>
          {morphing(span(2, 1))}
          {morphing(span(3, 1))}
        </>
      ),
      {},
      { prefix: "x" },
    );

    const ids = [...out.matchAll(/ id="([^"]*)"/g)].map((match) => match[1]);

    expect(ids.filter((id) => id?.startsWith("xw"))).toEqual(["xw1", "xw2"]);
    expect(out).toContain("xw2.begin+10s");
  });

  test("a motion that fills the loop is left as it was", () => {
    const out = emit(() => morphing(span(1, 8)));

    expect(attrsOf(out, "animate")[0]).toContain('repeatCount="indefinite"');
    expect(out).not.toContain("<set");
  });

  test("loop: false keeps the plain animate", () => {
    const still = emit(() => morphing(), { loop: false });

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

      expect(a.frames.some((frame) => !same(frame.png, a.frames[0]!.png))).toBe(true);
    });

  check("a morph that resets at the top of the loop", morphFramed, morphPlain);
  check("a morph that comes back", thereFramed, therePlain);

  check(
    "the merged set resets each later loop",
    morphFramed,
    morphPlain,
    [10, 10.5, 11.9, 12.5, 15, 20, 20.5, 21.9, 22.5, 29.9],
  );

  check(
    "blur on a scene played faster",
    blurred,
    blurPlain,
    [0, 0.5, 1.5, 2.5, 3, 5, 9.5, 10, 11.5, 12.5, 21],
  );

  test("restyle holds and starts the windowed morph where the plain one does", async () => {
    for (const at of [1, 2.5, 6, 11, 12.5]) {
      for (const paused of [true, false]) {
        const options = { at, paused };
        const later = paused ? [0, 3] : [0, 0.25, 3, 7];

        const [a, b] = await Promise.all([
          renderFrames(restyle(morphFramed, options), { times: later }),
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
