import { describe, expect, test } from "bun:test";
import assert from "node:assert/strict";
import { deflateSync } from "node:zlib";
import { checkScene, openScene, renderFrames } from "svjeez/frames";
import { loopLength, seek, restyle } from "svjeez/page";
import {
  Group,
  Image,
  Shape,
  Text,
  blur,
  circle,
  draw,
  ease,
  font,
  motion,
  path,
  picture,
  rect,
  scene,
  span,
  spin,
  tokens,
  track,
  type SceneElement,
} from "svjeez";
import { svg, type SceneOptions, type SvgOptions } from "svjeez/tools";
import { systemColorScheme } from "../src/scheme";

const emit = (
  [width, height]: readonly [number, number],
  duration: number,
  build: () => SceneElement,
  options: Partial<SceneOptions> & SvgOptions = {},
): string => {
  const { prefix, playbackRate, sources, ...rest } = options;

  return svg.emit(scene({ size: [width, height], duration, title: "Frames", ...rest }, build), {
    prefix,
    playbackRate,
    sources,
  });
};

const browser = await renderFrames(
  emit([4, 4], 1, () => <Shape geometry={rect(4, 4)} fill="#000000" />),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping frame tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

const pngSize = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset);

  return { width: view.getUint32(16), height: view.getUint32(20) };
};

const solidPng = (
  width: number,
  height: number,
  [r, g, b]: [number, number, number],
): Uint8Array => {
  const crc = (bytes: Uint8Array) => {
    let c = 0xffffffff;

    for (const byte of bytes) {
      c ^= byte;

      for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }

    return (c ^ 0xffffffff) >>> 0;
  };

  const chunk = (type: string, data: Uint8Array) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const out = Buffer.alloc(body.length + 8);
    out.writeUInt32BE(data.length, 0);
    body.copy(out, 4);
    out.writeUInt32BE(crc(body), body.length + 4);

    return out;
  };

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2], 8);

  const row = Buffer.concat([
    Buffer.from([0]),
    Buffer.from(Array.from({ length: width }, () => [r, g, b]).flat()),
  ]);

  const pixels = Buffer.concat(Array.from({ length: height }, () => row));

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

const same = (a: Uint8Array, b: Uint8Array) => Buffer.from(a).equals(Buffer.from(b));

const fade = emit([40, 20], 4, () => (
  <Shape geometry={rect(40, 20)} fill="#3EE6D6" opacity={track(0).to(1, span(1, 1), ease.linear)} />
));

const flooded = () => (
  <Shape geometry={rect(10, 10)} at={[5, 5]} fill="#FF0000" effects={[blur(track(0).set(3, 1))]} />
);

describe.if(browser)("renderFrames", () => {
  test("frames at different times differ, and holds between transitions render the same", async () => {
    const times = [0, 1.5, 2.5, 3.5];
    const { frames } = await renderFrames(fade, { times });

    expect(frames.map((frame) => frame.time)).toEqual(times);
    const [before, middle, after, later] = frames;
    assert(before && middle && after && later);

    expect(same(before.png, middle.png)).toBe(false);
    expect(same(middle.png, after.png)).toBe(false);
    expect(same(after.png, later.png)).toBe(true);
  });

  test("a curve starting to draw shows no round-cap dot at its far end", async () => {
    const curve = emit([70, 40], 1, () => (
      <Group>
        <Shape
          geometry={path().moveTo([10, 30]).curveTo([31.25, 30], [47.08, 19.52], [62.1, 7.48])}
          stroke={{ color: "#000000", width: 2, cap: "round" }}
          trim={draw(span(0, 0.45), { curve: ease.inOut })}
        />
        <Shape geometry={rect(45, 40)} fill="#FFFFFF" />
      </Group>
    ));

    const times = [0, 0.004, 0.008, 0.012];
    const { frames } = await renderFrames(curve, { times, scale: 2 });

    expect(frames.map((frame) => frame.time)).toEqual(times);
    const [blank, ...early] = frames;
    assert(blank);

    for (const frame of early) expect(same(frame.png, blank.png)).toBe(true);
  });

  test("the same time renders the same pixels every run", async () => {
    const [first, second] = await Promise.all([
      renderFrames(fade, { times: [1.5] }),
      renderFrames(fade, { times: [1.5] }),
    ]);

    expect(same(first.frames[0]!.png, second.frames[0]!.png)).toBe(true);
  });

  test("SMIL animations on filter primitives are seeked too", async () => {
    const out = emit([20, 20], 2, flooded);

    expect(out).toContain("<animate");
    const { frames } = await renderFrames(out, { times: [0.5, 1.5, 1.8] });
    expect(same(frames[0]!.png, frames[1]!.png)).toBe(false);
    expect(same(frames[1]!.png, frames[2]!.png)).toBe(true);
  });

  test("loop: false holds the last frame after the scene ends, inner loops and SMIL included", async () => {
    const made = (loop: boolean) =>
      emit(
        [40, 20],
        2,
        () => (
          <Group>
            {flooded()}
            <Shape
              geometry={rect(10, 10)}
              at={[20, 5]}
              fill="#3EE6D6"
              motion={motion({ offset: [0, 0] })
                .to({ offset: [10, 0] }, span(0, 0.5), ease.linear)
                .loop(0.5)}
            />
          </Group>
        ),
        { loop },
      );

    const once = (await renderFrames(made(false), { times: [0.3, 2, 3.5, 5.1] })).frames.map(
      (frame) => frame.png,
    );

    expect(same(once[0]!, once[2]!)).toBe(false);
    expect(same(once[1]!, once[2]!)).toBe(true);
    expect(same(once[2]!, once[3]!)).toBe(true);

    const looping = (await renderFrames(made(true), { times: [0.3, 2.3] })).frames.map(
      (frame) => frame.png,
    );

    expect(same(looping[0]!, looping[1]!)).toBe(true);
  });

  test("count spreads frames over one loop, at the requested scale", async () => {
    const { duration, frames } = await renderFrames(fade, { count: 4, scale: 2 });
    expect(duration).toBe(4);
    expect(frames.map((frame) => frame.time)).toEqual([0, 1, 2, 3]);
    expect(pngSize(frames[0]!.png)).toEqual({ width: 80, height: 40 });
  });

  test("a scene made only of loops lasts as long as their common period", async () => {
    const loops = emit([20, 20], 6, () => (
      <Group>
        <Shape
          geometry={rect(10, 10)}
          fill="#000000"
          motion={motion({ offset: [0, 0] })
            .to({ offset: [10, 0] }, span(0, 2), ease.linear)
            .loop(2)}
        />
        <Shape
          geometry={circle(4)}
          fill="#000000"
          motion={motion({ offset: [0, 0] })
            .to({ offset: [0, 10] }, span(0, 3), ease.linear)
            .loop(3)}
        />
      </Group>
    ));

    expect((await renderFrames(loops, { times: [0] })).duration).toBe(6);
  });

  test("periods that are rounded fractions of the scene duration still loop in the scene duration", async () => {
    const rings = emit([20, 20], 12, () => (
      <Group>
        <Shape
          geometry={rect(10, 10)}
          fill="#000000"
          motion={motion({ offset: [0, 0] }).to({ offset: [10, 0] }, span(0, 12), ease.linear)}
        />
        {[2, 3, 5, 7, 8].map((laps) => (
          <Shape geometry={circle(4)} fill="#000000" rotate={spin({ every: 12 / laps })} />
        ))}
      </Group>
    ));

    const { duration, frames } = await renderFrames(rings, { count: 4 });
    expect(duration).toBe(12);
    expect(frames.map((frame) => frame.time)).toEqual([0, 3, 6, 9]);
  });

  test("a sheet too big for one capture comes back whole, at a lower scale", async () => {
    const wide = emit([2000, 100], 4, () => <Shape geometry={rect(2000, 100)} fill="#3EE6D6" />);

    const { sheet } = await renderFrames(wide, { count: 4, scale: 3, sheet: true });
    const { width, height } = pngSize(sheet!);
    const css = { width: 4 * (2000 + 12) + 12, height: 100 + 12 + 20 + 12 };
    expect(width).toBeLessThanOrEqual(16384);
    expect(width).toBeGreaterThan(css.width);
    expect(height / width).toBeCloseTo(css.height / css.width, 2);
  });

  test("the contact sheet lays frames out in columns", async () => {
    const { sheet } = await renderFrames(fade, {
      times: [0, 1, 2, 3, 4, 5],
      sheet: { columns: 3 },
    });

    const { width, height } = pngSize(sheet!);
    expect(width).toBeGreaterThan(3 * 40);
    expect(width).toBeLessThan(4 * 40 + 60);
    expect(height).toBeGreaterThan(2 * 20);
  });

  test("a non-positive scale or column count is rejected", async () => {
    expect(renderFrames(fade, { times: [0], scale: 0 })).rejects.toThrow("scale");
    expect(renderFrames(fade, { times: [0], sheet: { columns: 1.5 } })).rejects.toThrow("columns");
  });

  test("an empty list of times is rejected before a sheet is sized", async () => {
    expect(renderFrames(fade, { times: [], sheet: true })).rejects.toThrow("at least one time");
  });

  test("an open scene captures what renderFrames renders, in a secure context, until closed", async () => {
    const opened = await openScene(fade, { scale: 2, colorScheme: "light" });

    try {
      expect(opened.duration).toBe(4);
      expect(
        await opened.evaluate((name) => name in window && isSecureContext, "VideoEncoder"),
      ).toBe(true);
      const { frames } = await renderFrames(fade, { times: [1.5], scale: 2, colorScheme: "light" });
      expect(same(await opened.capture(1.5), frames[0]!.png)).toBe(true);
    } finally {
      await opened.close();
    }
  });

  test("openScene() rejects a bad scale under the caller's name, before launching", async () => {
    expect(openScene(fade, { scale: -1 }, "video()")).rejects.toThrow(
      "video() needs a positive, finite scale, got -1.",
    );
  });

  test("frames follow the system color scheme unless told otherwise", async () => {
    const theme = tokens({ light: { paper: "#FFFFFF" }, dark: { paper: "#000000" } });
    const out = emit([20, 20], 1, () => <Shape geometry={rect(20, 20)} fill={theme.paper} />);

    const [light, dark, system, fallback] = await Promise.all([
      renderFrames(out, { times: [0], colorScheme: "light" }),
      renderFrames(out, { times: [0], colorScheme: "dark" }),
      renderFrames(out, { times: [0], colorScheme: "system" }),
      renderFrames(out, { times: [0] }),
    ]);

    expect(same(light.frames[0]!.png, dark.frames[0]!.png)).toBe(false);
    expect(fallback.colorScheme).toBe(systemColorScheme());
    expect(system.colorScheme).toBe(systemColorScheme());
    expect(
      same(fallback.frames[0]!.png, (systemColorScheme() === "dark" ? dark : light).frames[0]!.png),
    ).toBe(true);
  });

  test("an SVG without a numeric size is rejected", async () => {
    expect(
      renderFrames('<svg xmlns="http://www.w3.org/2000/svg"/>', { times: [0] }),
    ).rejects.toThrow("numeric width and height");
  });

  test("an embedded raster and an embedded SVG paint their own colors", async () => {
    const raster = picture(solidPng(8, 8, [0, 200, 0]));

    const vector = picture(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#c80000"/></svg>',
    );

    const paint = async (build: () => SceneElement) =>
      (await renderFrames(emit([20, 20], 1, build), { times: [0], colorScheme: "light" }))
        .frames[0]!.png;

    const png = await paint(() => <Image src={raster} width={20} height={20} />);
    const svgImage = await paint(() => <Image src={vector} width={20} height={20} />);
    const green = await paint(() => <Shape geometry={rect(20, 20)} fill="#00C800" />);
    const red = await paint(() => <Shape geometry={rect(20, 20)} fill="#C80000" />);
    expect(same(png, green)).toBe(true);
    expect(same(svgImage, red)).toBe(true);
    expect(same(png, svgImage)).toBe(false);
  });
});

describe.if(browser)("embedded fonts", async () => {
  const sans = await font.load(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url));

  const shot = async (out: string) =>
    (await renderFrames(out, { times: [0], colorScheme: "light", background: "#fff" })).frames[0]!
      .png;

  const paint = (build: () => SceneElement) => shot(emit([240, 60], 1, build));

  const line = (text: string, x: number, face = sans) => (
    <Text font={face} size={28} fill="#000000" at={[x, 12]}>
      {text}
    </Text>
  );

  test("an embedded font paints, rather than the fallback", async () => {
    const embedded = await paint(() => line("Wave AV", 10));
    const out = emit([240, 60], 1, () => line("Wave AV", 10));
    const fallback = await shot(out.replace(/font-family="[^"]*"/g, 'font-family="sans-serif"'));

    expect(out).toContain("@font-face");
    expect(same(embedded, fallback)).toBe(false);
  });

  test("a font cut down to the scene's glyphs paints the same as the whole file", async () => {
    const whole = font(
      await Bun.file(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)).bytes(),
      { subset: false },
    );

    expect(
      same(
        await paint(() => line("To AVA, café!", 10)),
        await paint(() => line("To AVA, café!", 10, whole)),
      ),
    ).toBe(true);
  });

  test("measure() matches the browser's layout, kerning included", async () => {
    const whole = await paint(() => line("To AVA", 10));

    const split = await paint(() => (
      <Group>
        {line("To AV", 10)}
        {line("A", 10 + sans.measure("To AVA", 28) - sans.measure("A", 28))}
      </Group>
    ));

    const unkerned = await paint(() => (
      <Group>
        {line("To AV", 10)}
        {line("A", 10 + sans.measure("To AV", 28))}
      </Group>
    ));

    expect(same(whole, split)).toBe(true);
    expect(same(whole, unkerned)).toBe(false);
  });
});

describe("renderFrames input", () => {
  const probe = emit([4, 4], 1, () => <Shape geometry={rect(4, 4)} fill="#000000" />);

  test("rejects a bad count or time before launching a browser", async () => {
    await expect(renderFrames(probe, { count: -1 })).rejects.toThrow(
      "renderFrames() needs a positive whole count, got -1.",
    );
    await expect(renderFrames(probe, { count: 1.5 })).rejects.toThrow("got 1.5.");
    await expect(renderFrames(probe, { times: [0, -2] })).rejects.toThrow(
      "renderFrames() needs finite, non-negative times, got -2.",
    );
  });
});

describe.if(browser)("prefix in one page", () => {
  const slide = (prefix?: string) =>
    emit(
      [100, 40],
      2,
      () => (
        <Shape
          geometry={rect(10, 10)}
          fill="#000000"
          motion={motion({ offset: [0, 0] }).to({ offset: [50, 0] }, span(0, 2))}
        />
      ),
      { prefix },
    );

  const fadeIn = (prefix?: string) =>
    emit(
      [100, 40],
      2,
      () => <Shape geometry={rect(10, 10)} fill="#000000" opacity={track(0).to(1, span(0, 2))} />,
      { prefix },
    );

  const halfway = async (html: string) => {
    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(html);

      return await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          animation.pause();
          animation.currentTime = 1000;
        }

        const [a, b] = [...document.querySelectorAll("svg rect")].map((el) => getComputedStyle(el));

        return { translate: a!.translate, opacity: Number(b!.opacity) };
      });
    } finally {
      await chrome.close();
    }
  };

  test("prefixed scenes each animate their own motion", async () => {
    const { translate, opacity } = await halfway(
      `<!doctype html><body>${slide("a-")}${fadeIn("b-")}`,
    );

    expect(parseFloat(translate)).toBeGreaterThan(25);
    expect(parseFloat(translate)).toBeLessThan(50);
    expect(opacity).toBeGreaterThan(0.5);
    expect(opacity).toBeLessThan(1);
  });

  test("unprefixed scenes clobber each other's keyframes", async () => {
    const { translate } = await halfway(`<!doctype html><body>${slide()}${fadeIn()}`);
    expect(translate).toBe("none");
  });
});

describe("restyle", () => {
  const made = (reducedMotion?: number) =>
    emit(
      [40, 20],
      4,
      () => (
        <Group>
          <Shape
            geometry={rect(40, 20)}
            fill="#3EE6D6"
            opacity={track(0).to(1, span(0, 4), ease.linear)}
          />
          <Shape
            geometry={rect(10, 10)}
            at={[10, 0]}
            fill="#EE6644"
            effects={[blur(track(0).to(4, span(0, 2), ease.linear))]}
          />
        </Group>
      ),
      reducedMotion === undefined ? {} : { reducedMotion },
    );

  test("an untouched copy is the input, and the reduced-motion freeze stays where posters read it", () => {
    const out = made(2.5);
    expect(restyle(out, {})).toBe(out);
    expect(out).toMatch(/animation-delay:-2\.5s!important/);
  });

  describe.if(browser)("in the browser", () => {
    const paint = async (out: string, time: number) =>
      (await renderFrames(out, { times: [time], colorScheme: "light" })).frames[0]!.png;

    test("a copy started at 1.5 s begins where the original is at 1.5 s, CSS and SMIL motions alike", async () => {
      const out = made();
      expect(out).toContain("<animate");
      expect(same(await paint(restyle(out, { at: 1.5 }), 0), await paint(out, 1.5))).toBe(true);
      expect(same(await paint(restyle(out, { at: 1.5 }), 0), await paint(out, 0))).toBe(false);
    });

    test("css after the scene's own recolors a scene painted with theme tokens", async () => {
      const theme = tokens({ light: { accent: "#3EE6D6" }, dark: { accent: "#3EE6D6" } });
      const themed = emit([20, 20], 1, () => <Shape geometry={rect(20, 20)} fill={theme.accent} />);

      const red = await paint(
        emit([20, 20], 1, () => <Shape geometry={rect(20, 20)} fill="#FF0000" />),
        0,
      );

      expect(themed).toContain("var(--accent)");
      expect(same(await paint(restyle(themed, { css: "svg{--accent:#ff0000}" }), 0), red)).toBe(
        true,
      );
      expect(same(await paint(themed, 0), red)).toBe(false);
    });

    test("still holds the reduced-motion frame, SMIL included", async () => {
      const out = made(2.5);
      expect(same(await paint(restyle(out, { still: true }), 0), await paint(out, 2.5))).toBe(true);
    });

    test("still stops every animation, a scene's own CSS among them", async () => {
      const own = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" width="20" height="20"><style>@keyframes spin{from{opacity:0}to{opacity:1}}rect{animation:spin 100s linear infinite}</style><rect width="20" height="20"/></svg>`;

      const opacityAfter = async (out: string) => {
        const { chromium } = await import("playwright-core");
        const chrome = await chromium.launch();

        try {
          const page = await chrome.newPage();
          await page.setContent(`<!doctype html><body>${out}`);
          await page.waitForTimeout(500);

          return await page.evaluate(() =>
            Number(getComputedStyle(document.querySelector("rect")!).opacity),
          );
        } finally {
          await chrome.close();
        }
      };

      expect(await opacityAfter(own)).toBeGreaterThan(0);
      expect(await opacityAfter(restyle(own, { still: true }))).toBe(0);
    });

    const asImage = async (
      out: string,
      waits: readonly number[],
      reducedMotion: "reduce" | "no-preference" = "no-preference",
    ) => {
      const { chromium } = await import("playwright-core");
      const chrome = await chromium.launch();

      try {
        const page = await chrome.newPage({ viewport: { width: 40, height: 20 }, reducedMotion });
        const src = `data:image/svg+xml,${encodeURIComponent(out)}`;
        await page.setContent(`<style>body{margin:0}img{display:block}</style><img src="${src}">`);
        await page.evaluate(() => document.querySelector("img")!.decode());
        const shots: Uint8Array[] = [];

        for (const wait of waits) {
          await page.waitForTimeout(wait);
          shots.push(new Uint8Array(await page.screenshot()));
        }

        return shots;
      } finally {
        await chrome.close();
      }
    };

    test("paused holds an <img> at the moment asked for, CSS and SMIL motions alike", async () => {
      const out = made();
      const [first, later] = await asImage(restyle(out, { at: 1.5, paused: true }), [50, 700]);
      const [start] = await asImage(restyle(out, { paused: true }), [50]);

      const drawn = emit([40, 20], 4, () => (
        <Group>
          <Shape geometry={rect(40, 20)} fill="#3EE6D6" opacity={0.375} />
          <Shape geometry={rect(10, 10)} at={[10, 0]} fill="#EE6644" effects={[blur(3)]} />
        </Group>
      ));

      const [frame] = await asImage(drawn, [50]);

      expect(same(first!, later!)).toBe(true);
      expect(same(first!, frame!)).toBe(true);
      expect(same(first!, start!)).toBe(false);
    });

    test("paused shows its moment to a viewer who prefers reduced motion, not the still frame", async () => {
      const paused = restyle(made(3.5), { at: 1.5, paused: true });
      const [reduced] = await asImage(paused, [50], "reduce");
      const [moving] = await asImage(paused, [50]);

      expect(same(reduced!, moving!)).toBe(true);
    });

    test("a scene that plays once stays valid, held, and on its last frame when started past its end", async () => {
      const square = (amount: number | ReturnType<typeof track<number>>) => () => (
        <Shape geometry={rect(10, 10)} fill="#000000" effects={[blur(amount)]} />
      );

      const once = emit([40, 20], 4, square(track(0).to(4, span(0, 4), ease.linear)), {
        loop: false,
      });

      const paused = restyle(once, { at: 1, paused: true });
      expect(paused.match(/fill="freeze"/g)).toHaveLength(1);
      const [first, later] = await asImage(paused, [50, 500]);
      expect(same(first!, later!)).toBe(true);

      const [last] = await asImage(emit([40, 20], 4, square(4)), [50]);
      const [past] = await asImage(restyle(once, { at: 6 }), [50]);
      const [heldPast] = await asImage(restyle(once, { at: 6, paused: true }), [50]);
      expect(same(past!, last!)).toBe(true);
      expect(same(heldPast!, last!)).toBe(true);
    });
  });
});

declare global {
  interface Window {
    seek?: typeof seek;
    loopLength?: typeof loopLength;
  }
}

describe.if(browser)("seek and loopLength on an inline <svg>", () => {
  const fading = (duration: number, options: SvgOptions = {}) =>
    emit(
      [20, 20],
      duration,
      () => (
        <Shape
          geometry={rect(20, 20)}
          fill="#000000"
          opacity={track(0).to(1, span(0, duration), ease.linear)}
        />
      ),
      options,
    );

  test("scrub one picture and leave the rest of the page playing", async () => {
    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(
        `<!doctype html><body>${fading(4, { prefix: "one" })}${fading(3, { prefix: "two" })}`,
      );
      await page.addScriptTag({
        content: `window.seek = ${seek};window.loopLength = ${loopLength};`,
      });

      const state = await page.evaluate(() => {
        const [one, two] = document.querySelectorAll("svg");

        window.seek!(1, one!);

        const opacity = (svg: Element) =>
          Number(getComputedStyle(svg.querySelector("rect")!).opacity);

        return {
          one: opacity(one!),
          two: two!.getAnimations({ subtree: true }).map((animation) => animation.playState),
          lengths: [window.loopLength!(one!), window.loopLength!(two!), window.loopLength!()],
        };
      });

      expect(state.one).toBeCloseTo(0.25, 2);
      expect(state.two).toEqual(["running"]);
      expect(state.lengths).toEqual([4, 3, 12]);
    } finally {
      await chrome.close();
    }
  });

  test("take scene seconds on a scene played at another rate", async () => {
    const fast = fading(4, { playbackRate: 2 });

    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(`<!doctype html><body>${fast}`);
      await page.addScriptTag({
        content: `window.seek = ${seek};window.loopLength = ${loopLength};`,
      });

      const state = await page.evaluate(() => {
        window.seek!(1);

        return {
          opacity: Number(getComputedStyle(document.querySelector("rect")!).opacity),
          length: window.loopLength!(),
        };
      });

      expect(state.opacity).toBeCloseTo(0.25, 2);
      expect(state.length).toBe(4);
    } finally {
      await chrome.close();
    }

    const opened = await openScene(fast);

    try {
      expect([opened.duration, opened.playbackRate]).toEqual([4, 2]);
    } finally {
      await opened.close();
    }
  });

  test("frames and layout checks seek CSS and SMIL to the same scene seconds at different rates", async () => {
    const picture = (body: string, rate = 1) =>
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50" width="100" height="50" data-playback-rate="${rate}">${body}</svg>`;

    const colorScheme = "light";

    const still = async (body: string) => {
      const { frames } = await renderFrames(picture(body), { times: [0], colorScheme });

      return frames[0]!.png;
    };

    const [empty, clipped] = await Promise.all([
      still(""),
      still('<rect x="-4" y="10" width="20" height="20"/>'),
    ]);

    for (const rate of [1, 2]) {
      const out = picture(
        `<style>
           @keyframes show { 0%, 50%, 100% { opacity: 0 } 25% { opacity: 1 } }
           .window { animation: show ${4 / rate}s steps(1, end) infinite }
         </style>
         <rect class="window" x="-4" y="10" width="4" height="20" data-key="window">
           <animate attributeName="width" values="4;20;4" keyTimes="0;.375;.625"
             calcMode="discrete" dur="${4 / rate}s" repeatCount="indefinite"/>
         </rect>`,
        rate,
      );

      const times = [0.75, 1.75, 2.25];

      const [rendered, checked] = await Promise.all([
        renderFrames(out, { times: [...times, 1.25], colorScheme }),
        checkScene(out, { times, colorScheme }),
      ]);

      expect(rendered.duration).toBe(4);
      expect(rendered.frames.map(({ png }, i) => same(png, i === 1 ? clipped : empty))).toEqual([
        true,
        true,
        true,
        true,
      ]);

      expect(checked.duration).toBe(4);
      expect(checked.findings.filter(({ rule }) => rule === "off-canvas")).toEqual([
        expect.objectContaining({ key: "window", times: [1.75], severity: "warning" }),
      ]);
    }
  });
});
