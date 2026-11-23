import { describe, expect, test } from "bun:test";
import { Group, Picture, ease, picture, rect, scene, span, track, type Vec } from "svjeez";
import { svg } from "svjeez/tools";
import { validateSvg } from "svjeez/frames";
import { blendVec, valueAt } from "../src/model/sample";

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
    const { href, bytes: cost, mode } = picture(fixtures.png);
    expect(mode).toBe("embed");
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

  const emit = (node: () => ReturnType<typeof Picture>) =>
    svg.emit(scene({ size: [400, 300], duration: 1, title: "Pic" }, node));

  const frame = (out: string) =>
    /<image[^>]* width="([^"]*)" height="([^"]*)"/.exec(out)?.slice(1).map(Number);

  test("derives the missing side from the aspect ratio, and defaults to intrinsic size", () => {
    expect(frame(emit(() => <Picture src={photo} width={150} />))).toEqual([150, 100]);
    expect(frame(emit(() => <Picture src={photo} height={50} />))).toEqual([75, 50]);
    expect(frame(emit(() => <Picture src={photo} />))).toEqual([300, 200]);
  });

  test("the picture's bytes go in as its data URI", () => {
    expect(emit(() => <Picture src={photo} at={[10, 20]} />)).toContain(`href="${photo.href}"`);
  });

  test("the output validates, including a data URI image", () => {
    const out = emit(() => (
      <Group>
        <Picture src={photo} />
        <Picture src={picture('<svg viewBox="0 0 10 5"><rect width="10" height="5"/></svg>')} />
      </Group>
    ));

    expect(validateSvg(out).errors).toEqual([]);
  });
});

describe("<Picture> fit and focus", () => {
  const photo = picture(fixtures.png);

  const emit = (node: () => ReturnType<typeof Picture>) =>
    svg.emit(scene({ size: [400, 300], duration: 1, title: "Pic" }, node));

  const view = (out: string) => [...out.matchAll(/<svg [^>]*viewBox="([^"]*)"/g)][1]?.[1];

  test("cover crops the overflow around the focus point", () => {
    const wide = emit(() => <Picture src={photo} width={100} height={100} />);
    expect(view(wide)).toBe("50 0 200 200");
    const left = emit(() => <Picture src={photo} width={100} height={100} focus={[0, 0.5]} />);
    expect(view(left)).toBe("0 0 200 200");
    const right = emit(() => <Picture src={photo} width={100} height={100} focus={[1, 0.5]} />);
    expect(view(right)).toBe("100 0 200 200");
  });

  test("contain shows all of it, centred or at the focus", () => {
    const out = emit(() => <Picture src={photo} width={100} height={100} fit="contain" />);
    expect(view(out)).toBe("0 -50 300 300");
  });

  test("fill stretches, and a matching box needs no crop", () => {
    const out = emit(() => <Picture src={photo} width={100} height={100} fit="fill" />);
    expect(view(out)).toBeUndefined();
    expect(out).toContain('width="100" height="100" preserveAspectRatio="none"');
    expect(view(emit(() => <Picture src={photo} width={150} height={100} />))).toBeUndefined();
  });

  test("a focus outside the picture is an error", () => {
    expect(() =>
      emit(() => <Picture src={photo} width={50} height={50} focus={[1.5, 0]} />),
    ).toThrow("focus");
  });

  test("zoom pushes in past the fit around the focus", () => {
    const cover = emit(() => <Picture src={photo} width={100} height={100} zoom={2} />);
    expect(view(cover)).toBe("100 50 100 100");
    const fill = emit(() => <Picture src={photo} width={100} height={100} fit="fill" zoom={2} />);
    expect(view(fill)).toBe("75 50 150 100");
  });

  test("a zoom of 0 or below is an error, in a track too", () => {
    expect(() => emit(() => <Picture src={photo} width={50} height={50} zoom={0} />)).toThrow(
      "zoom of 0",
    );
    expect(() =>
      emit(() => <Picture src={photo} width={50} height={50} zoom={track(1).to(-1, span(0, 1))} />),
    ).toThrow("zoom of -1");
  });

  test("a moving focus and zoom move the picture inside a box that stays put", () => {
    const moving = scene({ size: [400, 300], duration: 1, title: "Pic" }, () => (
      <Picture
        src={photo}
        width={100}
        height={100}
        at={[200, 150]}
        anchor="center"
        focus={track<Vec>([0, 0.5]).to([1, 0.5], span(0, 1), ease.linear)}
        zoom={track(1).to(2, span(0, 1), ease.linear)}
      />
    ));

    const frame = moving.root.kind === "group" ? moving.root.children[0] : undefined;
    expect(frame).toMatchObject({
      kind: "group",
      box: { width: 100, height: 100 },
      at: [150, 100],
    });
    const crop = frame?.kind === "group" ? frame.children[0] : undefined;
    expect(crop?.clip).toBeDefined();
    const image = crop?.kind === "group" ? crop.children[0] : undefined;
    const at = (t: number) => valueAt(image!.at, t, blendVec).map((n) => Math.round(n) + 0);
    expect(at(0)).toEqual([0, 0]);
    expect(at(1)).toEqual([-200, -50]);
    expect(validateSvg(svg.emit(moving)).errors).toEqual([]);
  });

  test("a clip frames the cropped picture in the box's own units", () => {
    const out = emit(() => (
      <Picture
        src={photo}
        width={100}
        height={100}
        clip={(own) => rect(own.width, own.height, { radius: [50, 50, 0, 0] })}
      />
    ));

    expect(out).toMatch(/<g [^>]*clip-path="url\(#c1\)"[^>]*>\s*<svg/);
    expect(validateSvg(out).errors).toEqual([]);
  });
});

describe("picture.ref", () => {
  const ref = picture.ref("https://cdn.test/couple.jpg", { width: 800, height: 1200 });

  const emit = (node: () => ReturnType<typeof Picture>) =>
    svg.emit(scene({ size: [400, 300], duration: 1, title: "Pic" }, node));

  test("draws the URL itself and costs only its length", () => {
    expect(ref).toMatchObject({ mode: "ref", bytes: 27, format: undefined });
    const out = emit(() => <Picture src={ref} width={100} height={100} />);
    expect(out).toContain('href="https://cdn.test/couple.jpg"');
    expect(out.length).toBeLessThan(2_000);
  });

  test("needs the image's size, and the output warns that <img> will not load it", () => {
    expect(() => picture.ref("a.jpg", { width: 0, height: 10 })).toThrow("width and height");
    const { errors, warnings } = validateSvg(emit(() => <Picture src={ref} width={100} />));
    expect(errors).toEqual([]);
    expect(warnings.some((warning) => warning.includes("<img>"))).toBe(true);
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
        warnings.some((warning) => warning.includes("<img>") && warning.includes("picture.ref()")),
      ).toBe(true);
    }
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
