import { describe, expect, test } from "bun:test";
import { Picture, fx, picture, render, validateSvg } from "svjeez";

const isText = (part: number | string): part is string => typeof part === "string";

const bytes = (...parts: (number | string)[]): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((part) => (isText(part) ? [...part].map((char) => char.charCodeAt(0)) : [part])),
  );

const be32 = (n: number) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
const le16 = (n: number) => [n & 255, (n >> 8) & 255];
const le24 = (n: number) => [n & 255, (n >> 8) & 255, (n >> 16) & 255];
const pad = (count: number) => Array.from({ length: count }, () => 0);

const lossless = (width: number, height: number) => {
  const packed = (width - 1) | ((height - 1) << 14);

  return bytes(
    "RIFF",
    ...pad(4),
    "WEBPVP8L",
    ...pad(4),
    0x2f,
    ...be32(packed).reverse(),
    ...pad(8),
  );
};

const fixtures = {
  png: bytes(
    0x89,
    "PNG\r\n",
    0x1a,
    0x0a,
    ...be32(13),
    "IHDR",
    ...be32(300),
    ...be32(200),
    8,
    6,
    0,
    0,
    0,
  ),
  jpeg: bytes(
    0xff,
    0xd8,
    0xff,
    0xe0,
    0,
    4,
    0,
    0,
    0xff,
    0xc0,
    0,
    17,
    8,
    0x00,
    0x96,
    0x01,
    0x2c,
    3,
    ...pad(9),
  ),
  gif: bytes("GIF89a", ...le16(40), ...le16(30), 0, 0, 0),
  webpLossy: bytes(
    "RIFF",
    ...pad(4),
    "WEBP",
    "VP8 ",
    ...pad(4),
    ...pad(3),
    0x9d,
    0x01,
    0x2a,
    ...le16(64),
    ...le16(48),
    ...pad(4),
  ),
  webpExtended: bytes(
    "RIFF",
    ...pad(4),
    "WEBPVP8X",
    ...pad(4),
    ...pad(4),
    ...le24(511),
    ...le24(255),
    ...pad(4),
  ),
};

describe("picture", () => {
  test("reads each raster format's size from its header", () => {
    expect(picture(fixtures.png)).toMatchObject({ format: "png", width: 300, height: 200 });
    expect(picture(fixtures.jpeg)).toMatchObject({ format: "jpeg", width: 300, height: 150 });
    expect(picture(fixtures.gif)).toMatchObject({ format: "gif", width: 40, height: 30 });
    expect(picture(fixtures.webpLossy)).toMatchObject({ format: "webp", width: 64, height: 48 });
    expect(picture(lossless(99, 77))).toMatchObject({ format: "webp", width: 99, height: 77 });
    expect(picture(fixtures.webpExtended)).toMatchObject({
      format: "webp",
      width: 512,
      height: 256,
    });
  });

  test("a JPEG finds its size past other segments", () => {
    const app = [0xff, 0xe1, 0, 8, 1, 2, 3, 4, 5, 6];

    const file = bytes(
      0xff,
      0xd8,
      ...app,
      0xff,
      0xc4,
      0,
      4,
      0,
      0,
      0xff,
      0xc2,
      0,
      17,
      8,
      0,
      20,
      0,
      10,
      3,
      ...pad(9),
    );

    expect(picture(file)).toMatchObject({ format: "jpeg", width: 10, height: 20 });
  });

  test("raster bytes become a base64 data URI that round-trips", () => {
    const { href, bytes: cost } = picture(fixtures.png);
    expect(href.startsWith("data:image/png;base64,")).toBe(true);
    expect(cost).toBe(href.length);
    expect(Buffer.from(href.split(",")[1]!, "base64").equals(Buffer.from(fixtures.png))).toBe(true);
  });

  test("a large raster encodes without overflowing the call stack", () => {
    const big = new Uint8Array(3_000_000);
    big.set(fixtures.png);
    expect(picture(big).href.length).toBeGreaterThan(4_000_000);
  });

  test("SVG takes its size from width and height, else the viewBox", () => {
    expect(
      picture('<svg xmlns="http://www.w3.org/2000/svg" width="120px" height="80"><rect/></svg>'),
    ).toMatchObject({ format: "svg", width: 120, height: 80 });
    expect(picture('<?xml version="1.0"?><svg viewBox="0 0 24 12"/>')).toMatchObject({
      width: 24,
      height: 12,
    });
    expect(picture('<svg width="100%" viewBox="0 0 10 5"/>')).toMatchObject({
      width: 10,
      height: 5,
    });
  });

  test("an SVG with no size is an error", () => {
    expect(() => picture("<svg><rect/></svg>")).toThrow("no size");
  });

  test("a JPEG turned a quarter by its EXIF orientation reports the size the browser draws", () => {
    const exif = (orientation: number, little: boolean) => {
      const u16 = (n: number) => (little ? [n & 0xff, n >> 8] : [n >> 8, n & 0xff]);

      const tiff = [
        ...(little ? [0x49, 0x49] : [0x4d, 0x4d]),
        ...u16(42),
        ...(little ? [8, 0, 0, 0] : [0, 0, 0, 8]),
        ...u16(1),
        ...u16(0x0112),
        ...u16(3),
        ...(little ? [1, 0, 0, 0] : [0, 0, 0, 1]),
        ...u16(orientation),
        0,
        0,
        0,
        0,
        0,
        0,
      ];

      const app1 = [0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];

      return bytes(
        0xff,
        0xd8,
        0xff,
        0xe1,
        0,
        app1.length + 2,
        ...app1,
        0xff,
        0xc0,
        0,
        17,
        8,
        0x00,
        0x96,
        0x01,
        0x2c,
        3,
        ...pad(9),
      );
    };

    expect(picture(exif(6, false))).toMatchObject({ width: 150, height: 300 });
    expect(picture(exif(8, true))).toMatchObject({ width: 150, height: 300 });
    expect(picture(exif(3, true))).toMatchObject({ width: 300, height: 150 });
  });

  test("SVG goes in as percent-encoded text and decodes back to the markup", () => {
    const markup = '<svg viewBox="0 0 10 10"><rect fill="#f00" width="10%" height="10"/></svg>';
    const { href } = picture(markup);
    expect(href.startsWith("data:image/svg+xml,")).toBe(true);
    expect(href).not.toContain("base64");
    expect(href).not.toMatch(/[<>"#]/);
    expect(decodeURIComponent(href.slice("data:image/svg+xml,".length))).toBe(markup);
  });

  test("text, quotes and whitespace inside an SVG survive embedding exactly", () => {
    const markup =
      '<svg viewBox="0 0 10 10"><text xml:space="preserve">a="\t\tb</text>\n<rect fill="#00f" width="1" height="1"/></svg>';

    expect(decodeURIComponent(picture(markup).href.slice("data:image/svg+xml,".length))).toBe(
      markup,
    );
  });

  test("an SVG is only an SVG when the root element is <svg>", () => {
    expect(() =>
      picture('<!doctype html><html><body><svg width="16" height="16"></svg></body></html>'),
    ).toThrow("Unknown image format");
    const prolog = `<?xml version="1.0"?>\n<!-- ${"license ".repeat(2000)} <svg width="1" height="1"> -->\n<!DOCTYPE svg>\n`;
    expect(picture(`${prolog}<svg viewBox="0 0 100 50"/>`)).toMatchObject({
      format: "svg",
      width: 100,
      height: 50,
    });
  });

  test("an SVG with one side and a viewBox derives the other from the viewBox ratio", () => {
    expect(picture('<svg width="200" viewBox="0 0 20 10"/>')).toMatchObject({
      width: 200,
      height: 100,
    });
    expect(picture('<svg height="50" viewBox="0 0 20 10"/>')).toMatchObject({
      width: 100,
      height: 50,
    });
  });

  test("an unknown format names the supported ones", () => {
    expect(() => picture(bytes(1, 2, 3, 4, 5, 6, 7, 8, 9, 10))).toThrow(
      /Unknown image format.*png.*jpeg.*gif.*webp.*svg/,
    );
    expect(() => picture("hello")).toThrow("Unknown image format");
  });

  test("load reads a file by its content, not its extension", async () => {
    const path = `${import.meta.dir}/.picture-fixture.txt`;
    await Bun.write(path, fixtures.gif);

    try {
      expect(await picture.load(path)).toMatchObject({ format: "gif", width: 40, height: 30 });
      expect(await picture.load(new URL(`file://${path}`))).toMatchObject({ format: "gif" });
    } finally {
      await Bun.file(path).delete();
    }
  });

  test("load rejects a non-OK response with its status", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("nope", { status: 404 }) });

    try {
      await expect(picture.load(`http://localhost:${server.port}/x.png`)).rejects.toThrow("404");
    } finally {
      await server.stop(true);
    }
  });
});

describe("<Picture>", () => {
  const photo = picture(fixtures.png);

  const scene = (node: ReturnType<typeof Picture>) =>
    render({ width: 400, height: 300, duration: 1, title: "Pic" }, node);

  const frame = (svg: string) =>
    /<rect x="[^"]*" y="[^"]*" width="([^"]*)" height="([^"]*)"/.exec(svg)?.slice(1).map(Number);

  test("derives the missing side from the aspect ratio, and defaults to intrinsic size", () => {
    expect(frame(scene(<Picture src={photo} x={0} y={0} width={150} />))).toEqual([150, 100]);
    expect(frame(scene(<Picture src={photo} x={0} y={0} height={50} />))).toEqual([75, 50]);
    expect(frame(scene(<Picture src={photo} x={0} y={0} />))).toEqual([300, 200]);
    expect(scene(<Picture src={photo} width={150} />)).toBe(
      scene(<Picture src={photo} x={0} y={0} width={150} />),
    );
  });

  test("fit scales and centers the image in its frame, defaulting to cover", () => {
    expect(scene(<Picture src={photo} x={10} y={10} width={100} height={100} />)).toContain(
      'transform="translate(-15 10) scale(0.5 0.5)"',
    );
    expect(
      scene(<Picture src={photo} x={10} y={10} width={100} height={100} fit="contain" />),
    ).toContain('transform="translate(10 26.6667) scale(0.333333 0.333333)"');
    expect(
      scene(<Picture src={photo} x={10} y={10} width={100} height={100} fit="fill" />),
    ).toContain('transform="translate(10 10) scale(0.333333 0.5)"');
  });

  test("cover and radius clip to the frame; contain and fill need no clip", () => {
    const rounded = scene(
      <Picture src={photo} x={10} y={20} width={100} height={60} radius={12} />,
    );

    expect(rounded).toMatch(
      /<clipPath[^>]*>\s*<rect x="10" y="20" width="100" height="60" rx="12"/,
    );
    expect(scene(<Picture src={photo} x={0} y={0} fit="contain" />)).not.toContain("clipPath");
  });

  test("a picture drawn many times embeds its bytes once", () => {
    const svg = scene(
      <>
        <Picture src={photo} x={0} y={0} />
        <Picture src={photo} x={100} y={0} fit="contain" />
        <Picture src={photo} x={200} y={0} fit="fill" radius={8} />
      </>,
    );

    expect(svg.split(photo.href).length - 1).toBe(1);
  });

  test("alt labels the picture, and no alt hides it", () => {
    expect(scene(<Picture src={photo} x={0} y={0} alt="A harbor" />)).toContain(
      'role="img" aria-label="A harbor"',
    );
    expect(scene(<Picture src={photo} x={0} y={0} />)).toContain('aria-hidden="true"');
  });

  test("the output validates, including a data URI image", () => {
    expect(validateSvg(scene(<Picture src={photo} x={0} y={0} radius={4} />)).errors).toEqual([]);
  });
});

describe("image filters", () => {
  const filtered = (filter: ReturnType<typeof fx.grayscale>) =>
    render(
      { width: 10, height: 10, duration: 1, title: "Fx" },
      <rect width={10} height={10} filter={filter} />,
    );

  test("each filter renders into the scene", () => {
    expect(filtered(fx.grayscale({ amount: 0.25 }))).toContain('values="0.75"');
    expect(filtered(fx.blur(3))).toContain('stdDeviation="3"');
    expect(
      filtered(fx.shadow({ dx: 2, dy: 3, blur: 4, color: "#000000", opacity: 0.5 })),
    ).toContain("<feDropShadow");
  });

  test("duotone maps black to dark and white to light", () => {
    const svg = filtered(fx.duotone({ dark: "#000000", light: "#ff8000" }));
    const values = /values="([^"]+)"/.exec(svg)![1]!.split(" ").map(Number);

    const apply = (gray: number) =>
      [0, 1, 2].map((row) => {
        // SAFETY: duotone writes a four-row, five-value color matrix, so each row slice holds five numbers.
        const [r, g, b, , offset] = values.slice(row * 5, row * 5 + 5) as [
          number,
          number,
          number,
          number,
          number,
        ];

        return (r + g + b) * gray + offset;
      });

    expect(apply(0)).toEqual([0, 0, 0]);
    expect(apply(1)[0]).toBeCloseTo(1, 3);
    expect(apply(1)[1]).toBeCloseTo(128 / 255, 3);
    expect(svg).toContain('color-interpolation-filters="sRGB"');
    // @ts-expect-error a named color is a type error; untyped callers still get the runtime check
    expect(() => fx.duotone({ dark: "red", light: "#fff" })).toThrow(
      "fx.duotone() needs #rgb or #rrggbb colors, got red.",
    );
  });
});

describe("image validation", () => {
  const wrap = (inner: string) => `<svg viewBox="0 0 10 10">${inner}</svg>`;

  test("an external image href warns and points to picture.load, without failing the render", () => {
    for (const tag of [
      '<image href="photo.png"/>',
      '<image xlink:href="https://x.test/a.png"/>',
      '<feImage href="a.png"/>',
      '<use href="sprite.svg#a"/>',
      "<image href='a.png'/>",
      '<image x="1" href = "a.png"/>',
    ]) {
      const { errors, warnings } = validateSvg(wrap(tag));
      expect(errors).toEqual([]);
      expect(
        warnings.some((warning) => warning.includes("<img>") && warning.includes("picture.load()")),
      ).toBe(true);
    }

    expect(() =>
      render(
        { width: 10, height: 10, duration: 1, title: "x" },
        <image href="photo.png" width={10} height={10} />,
      ),
    ).not.toThrow();
  });

  test("fragment and data hrefs, and links, pass", () => {
    const { errors } = validateSvg(
      wrap(
        '<symbol id="a"/><use href="#a"/><image href="data:image/png;base64,AAAA"/><a href="https://x.test"><rect/></a>',
      ),
    );

    expect(errors).toEqual([]);
  });

  test("a data URI over 256 KB warns with its size", () => {
    const big = `data:image/png;base64,${"A".repeat(300 * 1024)}`;
    const { warnings } = validateSvg(wrap(`<image href="${big}"/>`));
    expect(
      warnings.some((warning) => warning.includes("300 KB") && warning.includes("recompress")),
    ).toBe(true);
    expect(validateSvg(wrap('<image href="data:image/png;base64,AAAA"/>')).warnings).toEqual([]);
  });
});
