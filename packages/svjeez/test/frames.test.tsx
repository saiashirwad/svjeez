import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import {
  Once,
  Picture,
  def,
  ease,
  font,
  motion,
  picture,
  render,
  restyle,
  type Child,
  type SvgNode,
} from "svjeez";
import { adaptive, systemDark, systemLight } from "svjeez/extras";
import { openScene, renderFrames } from "svjeez/frames";
import { loopLength, seek } from "svjeez/page";
import { systemColorScheme } from "../src/scheme";

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

const fade = render(
  { width: 40, height: 20, duration: 4, title: "Fade" },
  <rect
    width={40}
    height={20}
    fill="#3EE6D6"
    animation={motion({ opacity: 0 }).at(1).to({ opacity: 1 }, 1, ease.linear)}
  />,
);

describe.if(browser)("renderFrames", () => {
  test("frames at different times differ, and holds between transitions render the same", async () => {
    const { frames } = await renderFrames(fade, { times: [0, 1.5, 2.5, 3.5] });

    // SAFETY: renderFrames returns one frame for each of the four times passed above.
    const [before, middle, after, later] = frames.map((frame) => frame.png) as [
      Uint8Array,
      Uint8Array,
      Uint8Array,
      Uint8Array,
    ];

    expect(same(before, middle)).toBe(false);
    expect(same(middle, after)).toBe(false);
    expect(same(after, later)).toBe(true);
  });

  test("the same time renders the same pixels every run", async () => {
    const [first, second] = await Promise.all([
      renderFrames(fade, { times: [1.5] }),
      renderFrames(fade, { times: [1.5] }),
    ]);

    expect(same(first.frames[0]!.png, second.frames[0]!.png)).toBe(true);
  });

  test("SMIL animations on filter primitives are seeked too", async () => {
    const flood = def.filter(
      {},
      <feFlood
        floodColor="#ff0000"
        animation={motion({ floodColor: "#ff0000" }).at(1).set({ floodColor: "#0000ff" })}
      />,
    );

    const svg = render(
      { width: 20, height: 20, duration: 2, title: "Flood" },
      <rect width={20} height={20} filter={flood} />,
    );

    expect(svg).toContain("<animate");
    const { frames } = await renderFrames(svg, { times: [0.5, 1.5, 1.8] });
    expect(same(frames[0]!.png, frames[1]!.png)).toBe(false);
    expect(same(frames[1]!.png, frames[2]!.png)).toBe(true);
  });

  test("loop: false holds the last frame after the scene ends, inner loops and SMIL included", async () => {
    const flood = def.filter(
      {},
      <feFlood
        floodColor="#ff0000"
        animation={motion({ floodColor: "#ff0000" }).at(1).set({ floodColor: "#0000ff" })}
      />,
    );

    const scene = (loop: boolean) =>
      render(
        { width: 40, height: 20, duration: 2, title: "Once", loop },
        <>
          <rect width={20} height={20} filter={flood} />
          <rect
            y={5}
            width={10}
            height={10}
            fill="#3EE6D6"
            animation={motion({ x: 20 }).to({ x: 30 }, 0.5, ease.linear).loop(0.5)}
          />
        </>,
      );

    const once = (await renderFrames(scene(false), { times: [0.3, 2, 3.5, 5.1] })).frames.map(
      (frame) => frame.png,
    );

    expect(same(once[0]!, once[2]!)).toBe(false);
    expect(same(once[1]!, once[2]!)).toBe(true);
    expect(same(once[2]!, once[3]!)).toBe(true);

    const looping = (await renderFrames(scene(true), { times: [0.3, 2.3] })).frames.map(
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
    const svg = render(
      { width: 20, height: 20, duration: 6, title: "Loops" },
      <>
        <rect
          width={10}
          height={10}
          animation={motion({ x: 0 }).to({ x: 10 }, 2, ease.linear).loop(2)}
        />
        <circle r={4} animation={motion({ y: 0 }).to({ y: 10 }, 3, ease.linear).loop(3)} />
      </>,
    );

    expect((await renderFrames(svg, { times: [0] })).duration).toBe(6);
  });

  test("periods that are rounded fractions of the scene duration still loop in the scene duration", async () => {
    const ring = (laps: number) => (
      <circle
        r={4}
        animation={motion({ rotate: 0 })
          .to({ rotate: 360 }, 12 / laps, ease.linear)
          .loop(12 / laps)}
      />
    );

    const svg = render(
      { width: 20, height: 20, duration: 12, title: "Rings" },
      <>
        <rect width={10} height={10} animation={motion({ x: 0 }).to({ x: 10 }, 12, ease.linear)} />
        {[2, 3, 5, 7, 8].map(ring)}
      </>,
    );

    const { duration, frames } = await renderFrames(svg, { count: 4 });
    expect(duration).toBe(12);
    expect(frames.map((frame) => frame.time)).toEqual([0, 3, 6, 9]);
  });

  test("a sheet too big for one capture comes back whole, at a lower scale", async () => {
    const wide = render(
      { width: 2000, height: 100, duration: 4, title: "Wide" },
      <rect width={2000} height={100} fill="#3EE6D6" />,
    );

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

  test("an open scene captures what renderFrames renders, in a secure context, until closed", async () => {
    const scene = await openScene(fade, { scale: 2, colorScheme: "light" });

    try {
      expect(scene.duration).toBe(4);
      expect(
        await scene.evaluate((name) => name in window && isSecureContext, "VideoEncoder"),
      ).toBe(true);
      const { frames } = await renderFrames(fade, { times: [1.5], scale: 2, colorScheme: "light" });
      expect(same(await scene.capture(1.5), frames[0]!.png)).toBe(true);
    } finally {
      await scene.close();
    }
  });

  test("openScene() rejects a bad scale under the caller's name, before launching", async () => {
    expect(openScene(fade, { scale: -1 }, "renderVideo()")).rejects.toThrow(
      "renderVideo() needs a positive, finite scale, got -1.",
    );
  });

  test("frames follow the system color scheme unless told otherwise", async () => {
    const svg = render(
      {
        width: 20,
        height: 20,
        duration: 1,
        title: "Scheme",
        css: "rect{fill:#ffffff}@media (prefers-color-scheme:dark){rect{fill:#000000}}",
      },
      <rect width={20} height={20} />,
    );

    const [light, dark, system, fallback] = await Promise.all([
      renderFrames(svg, { times: [0], colorScheme: "light" }),
      renderFrames(svg, { times: [0], colorScheme: "dark" }),
      renderFrames(svg, { times: [0], colorScheme: "system" }),
      renderFrames(svg, { times: [0] }),
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
    const scene = (child: SvgNode) =>
      render({ width: 20, height: 20, duration: 1, title: "Embed" }, child);

    const raster = picture(solidPng(8, 8, [0, 200, 0]));

    const vector = picture(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#c80000"/></svg>',
    );

    const paint = async (child: SvgNode) =>
      (await renderFrames(scene(child), { times: [0], colorScheme: "light" })).frames[0]!.png;

    const png = await paint(<Picture src={raster} x={0} y={0} width={20} height={20} />);
    const svg = await paint(<Picture src={vector} x={0} y={0} width={20} height={20} />);
    const green = await paint(<rect width={20} height={20} fill="#00c800" />);
    const red = await paint(<rect width={20} height={20} fill="#c80000" />);
    expect(same(png, green)).toBe(true);
    expect(same(svg, red)).toBe(true);
    expect(same(png, svg)).toBe(false);
  });
});

describe.if(browser)("embedded fonts", async () => {
  const sans = await font.load(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url));

  const paint = async (child: Child) =>
    (
      await renderFrames(
        render({ width: 240, height: 60, duration: 1, title: "Font" }, <g fill="#000">{child}</g>),
        { times: [0], colorScheme: "light", background: "#fff" },
      )
    ).frames[0]!.png;

  test("an embedded font paints, rather than the fallback", async () => {
    const embedded = await paint(
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        Wave AV
      </text>,
    );

    const fallback = await paint(
      <text x={10} y={40} fontSize={28} fontFamily="sans-serif">
        Wave AV
      </text>,
    );

    expect(same(embedded, fallback)).toBe(false);
  });

  test("a font cut down to the scene's glyphs paints the same as the whole file", async () => {
    const whole = font(
      await Bun.file(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url)).bytes(),
      { subset: false },
    );

    const line = (
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        To AVA, café!
      </text>
    );

    const full = (
      <text x={10} y={40} fontSize={28} fontFamily={whole}>
        To AVA, café!
      </text>
    );

    expect(same(await paint(line), await paint(full))).toBe(true);
  });

  test("measure() matches the browser's layout, kerning included", async () => {
    const whole = await paint(
      <text x={10} y={40} fontSize={28} fontFamily={sans}>
        To AVA
      </text>,
    );

    const split = await paint(
      <>
        <text x={10} y={40} fontSize={28} fontFamily={sans}>
          To AV
        </text>
        <text
          x={10 + sans.measure("To AVA", 28) - sans.measure("A", 28)}
          y={40}
          fontSize={28}
          fontFamily={sans}
        >
          A
        </text>
      </>,
    );

    const unkerned = await paint(
      <>
        <text x={10} y={40} fontSize={28} fontFamily={sans}>
          To AV
        </text>
        <text x={10 + sans.measure("To AV", 28)} y={40} fontSize={28} fontFamily={sans}>
          A
        </text>
      </>,
    );

    expect(same(whole, split)).toBe(true);
    expect(same(whole, unkerned)).toBe(false);
  });
});

describe("renderFrames input", () => {
  const svg = render(
    { width: 4, height: 4, duration: 1, title: "Probe" },
    <rect width={4} height={4} />,
  );

  test("rejects a bad count or time before launching a browser", async () => {
    await expect(renderFrames(svg, { count: -1 })).rejects.toThrow(
      "renderFrames() needs a positive whole count, got -1.",
    );
    await expect(renderFrames(svg, { count: 1.5 })).rejects.toThrow("got 1.5.");
    await expect(renderFrames(svg, { times: [0, -2] })).rejects.toThrow(
      "renderFrames() needs finite, non-negative times, got -2.",
    );
  });
});

describe.if(browser)("prefix in one page", () => {
  const slide = (prefix?: string) =>
    render(
      { width: 100, height: 40, duration: 2, title: "A", prefix },
      <rect id="a" width={10} height={10} animation={motion({ x: 0 }).at(0).to({ x: 50 }, 2)} />,
    );

  const fade = (prefix?: string) =>
    render(
      { width: 100, height: 40, duration: 2, title: "B", prefix },
      <rect
        id="b"
        width={10}
        height={10}
        animation={motion({ opacity: 0 }).at(0).to({ opacity: 1 }, 2)}
      />,
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

        const read = (id: string) => getComputedStyle(document.getElementById(id)!);

        return { translate: read("a").translate, opacity: Number(read("b").opacity) };
      });
    } finally {
      await chrome.close();
    }
  };

  test("prefixed scenes each animate their own motion", async () => {
    const { translate, opacity } = await halfway(
      `<!doctype html><body>${slide("a-")}${fade("b-")}`,
    );

    expect(parseFloat(translate)).toBeGreaterThan(25);
    expect(parseFloat(translate)).toBeLessThan(50);
    expect(opacity).toBeGreaterThan(0.5);
    expect(opacity).toBeLessThan(1);
  });

  test("unprefixed scenes clobber each other's keyframes", async () => {
    const { translate } = await halfway(`<!doctype html><body>${slide()}${fade()}`);
    expect(translate).toBe("none");
  });
});

describe("restyle", () => {
  const scene = (reducedMotion?: { at: number }) =>
    render(
      { width: 40, height: 20, duration: 4, title: "Restyle", reducedMotion },
      <>
        <rect
          width={40}
          height={20}
          fill="#3EE6D6"
          animation={motion({ opacity: 0 }).to({ opacity: 1 }, 4, ease.linear)}
        />
        <rect
          x={10}
          width={10}
          height={10}
          fill="#E64"
          animation={motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear)}
        />
      </>,
    );

  test("an untouched copy is the input, and the reduced-motion freeze stays where posters read it", () => {
    const svg = scene({ at: 2.5 });
    expect(restyle(svg, {})).toBe(svg);
    expect(svg).toMatch(/animation-delay:-2\.5s!important/);
  });

  describe.if(browser)("in the browser", () => {
    const paint = async (svg: string, time: number) =>
      (await renderFrames(svg, { times: [time], colorScheme: "light" })).frames[0]!.png;

    test("a copy started at 1.5 s begins where the original is at 1.5 s, CSS and SMIL motions alike", async () => {
      const svg = scene();
      expect(svg).toContain("<animate");
      expect(same(await paint(restyle(svg, { at: 1.5 }), 0), await paint(svg, 1.5))).toBe(true);
      expect(same(await paint(restyle(svg, { at: 1.5 }), 0), await paint(svg, 0))).toBe(false);
    });

    test("css after the scene's own recolors a scene painted with theme variables", async () => {
      const { theme, css } = adaptive({ dark: systemDark, light: systemLight });

      const svg = render(
        { width: 20, height: 20, duration: 1, title: "Themed", css },
        <rect width={20} height={20} fill={theme.base0D} />,
      );

      const red = await paint(
        render(
          { width: 20, height: 20, duration: 1, title: "Red" },
          <rect width={20} height={20} fill="#ff0000" />,
        ),
        0,
      );

      expect(same(await paint(restyle(svg, { css: "svg{--base0D:#ff0000}" }), 0), red)).toBe(true);
      expect(same(await paint(svg, 0), red)).toBe(false);
    });

    test("still holds the reduced-motion frame, SMIL included", async () => {
      const svg = scene({ at: 2.5 });
      expect(same(await paint(restyle(svg, { still: true }), 0), await paint(svg, 2.5))).toBe(true);
    });

    test("still stops every animation, a scene's own CSS among them", async () => {
      const own = render(
        {
          width: 20,
          height: 20,
          duration: 1,
          title: "Own",
          css: "@keyframes spin{from{opacity:0}to{opacity:1}}rect{animation:spin 100s linear infinite}",
        },
        <rect width={20} height={20} />,
      );

      const opacityAfter = async (svg: string) => {
        const { chromium } = await import("playwright-core");
        const chrome = await chromium.launch();

        try {
          const page = await chrome.newPage();
          await page.setContent(`<!doctype html><body>${svg}`);
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

    /** Screenshots of the SVG shown as an `<img>`, the way a page shows it, after each wait in milliseconds. */
    const asImage = async (
      svg: string,
      waits: readonly number[],
      reducedMotion: "reduce" | "no-preference" = "no-preference",
    ) => {
      const { chromium } = await import("playwright-core");
      const chrome = await chromium.launch();

      try {
        const page = await chrome.newPage({ viewport: { width: 40, height: 20 }, reducedMotion });
        const src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
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
      const svg = scene();
      const [first, later] = await asImage(restyle(svg, { at: 1.5, paused: true }), [50, 700]);
      const [start] = await asImage(restyle(svg, { paused: true }), [50]);

      const drawn = render(
        { width: 40, height: 20, duration: 4, title: "1.5 s in" },
        <>
          <rect width={40} height={20} fill="#3EE6D6" opacity={0.375} />
          <rect
            x={10}
            width={10}
            height={10}
            fill="#E64"
            filter={def.filter({}, <feGaussianBlur stdDeviation={3} />)}
          />
        </>,
      );

      const [frame] = await asImage(drawn, [50]);

      expect(same(first!, later!)).toBe(true);
      expect(same(first!, frame!)).toBe(true);
      expect(same(first!, start!)).toBe(false);
    });

    test("paused shows its moment to a viewer who prefers reduced motion, not the still frame", async () => {
      const paused = restyle(scene({ at: 3.5 }), { at: 1.5, paused: true });
      const [reduced] = await asImage(paused, [50], "reduce");
      const [moving] = await asImage(paused, [50]);

      expect(same(reduced!, moving!)).toBe(true);
    });

    test("<Once> parts hold their end on the loop clock, and onceAt gives them a clock of their own", async () => {
      const fade = (over: number) => motion({ opacity: 0 }).to({ opacity: 1 }, over, ease.linear);
      const blur = motion({ blur: 0 }).to({ blur: 4 }, 2, ease.linear);

      const svg = render(
        { width: 40, height: 20, duration: 2, title: "Once" },
        <>
          <rect width={20} height={20} fill="#3EE6D6" animation={fade(2)} />
          <Once>
            <rect x={20} width={20} height={10} fill="#E64" animation={fade(1)} />
            <rect x={25} y={12} width={10} height={6} fill="#246" animation={blur} />
          </Once>
        </>,
      );

      const drawn = (loop: number, once: number, deviation: number) =>
        render(
          { width: 40, height: 20, duration: 2, title: "Drawn" },
          <>
            <rect width={20} height={20} fill="#3EE6D6" opacity={loop} />
            <rect x={20} width={20} height={10} fill="#E64" opacity={once} />
            <rect
              x={25}
              y={12}
              width={10}
              height={6}
              fill="#246"
              filter={def.filter(
                { filterUnits: "userSpaceOnUse", x: 0, y: 0, width: 40, height: 20 },
                <feGaussianBlur stdDeviation={deviation} />,
              )}
            />
          </>,
        );

      const [late, own, ...references] = await Promise.all([
        asImage(restyle(svg, { at: 2.5, paused: true }), [50]),
        asImage(restyle(svg, { at: 2.5, onceAt: 0.5, paused: true }), [50]),
        asImage(drawn(0.25, 1, 4), [50]),
        asImage(drawn(0.25, 0.5, 1), [50]),
      ]);

      expect(same(late[0]!, references[0]![0]!)).toBe(true);
      expect(same(own[0]!, references[1]![0]!)).toBe(true);
    });

    test("a scene that plays once stays valid, held, and on its last frame when started past its end", async () => {
      const once = render(
        { width: 40, height: 20, duration: 4, title: "Once", loop: false },
        <rect
          width={10}
          height={10}
          animation={motion({ blur: 0 }).to({ blur: 4 }, 4, ease.linear)}
        />,
      );

      const paused = restyle(once, { at: 1, paused: true });
      expect(paused.match(/fill="freeze"/g)).toHaveLength(1);
      const [first, later] = await asImage(paused, [50, 500]);
      expect(same(first!, later!)).toBe(true);

      const ended = render(
        { width: 40, height: 20, duration: 4, title: "Ended" },
        <rect
          width={10}
          height={10}
          filter={def.filter(
            { filterUnits: "userSpaceOnUse", x: 0, y: 0, width: 40, height: 20 },
            <feGaussianBlur stdDeviation={4} />,
          )}
        />,
      );

      const [last] = await asImage(ended, [50]);
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
  const scene = (prefix: string, duration: number) =>
    render(
      { width: 20, height: 20, duration, title: prefix, prefix },
      <rect
        width={20}
        height={20}
        animation={motion({ opacity: 0 }).to({ opacity: 1 }, duration, ease.linear)}
      />,
    );

  test("scrub one picture and leave the rest of the page playing", async () => {
    const { chromium } = await import("playwright-core");
    const chrome = await chromium.launch();

    try {
      const page = await chrome.newPage();
      await page.setContent(`<!doctype html><body>${scene("one", 4)}${scene("two", 3)}`);
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
});
