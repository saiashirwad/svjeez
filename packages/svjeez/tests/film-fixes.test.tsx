import { describe, expect, test } from "bun:test";
import { inflateSync } from "node:zlib";
import { renderFrames } from "svjeez/frames";
import {
  Group,
  Shape,
  circle,
  emboss,
  line,
  merge,
  rect,
  scene,
  span,
  track,
  type SceneElement,
} from "svjeez";
import { placements, svg } from "svjeez/tools";

const made = (size: readonly [number, number], build: () => SceneElement) =>
  scene({ size: [size[0], size[1]], duration: 2, title: "Fixes", loop: false }, build);

const emit = (size: readonly [number, number], build: () => SceneElement) =>
  svg.emit(made(size, build));

const browser = await renderFrames(
  emit([4, 4], () => <Shape geometry={rect(4, 4)} fill="#000000" />),
  { times: [0] },
).then(
  () => true,
  (error: Error) => {
    if (process.env.CI) throw error;
    console.warn(`skipping pixel tests: ${error.message.split("\n")[0]}`);

    return false;
  },
);

/** Decodes an 8-bit RGB or RGBA PNG into a pixel reader. */
const pixels = (png: Uint8Array) => {
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  const width = view.getUint32(16);
  const channels = png[25] === 6 ? 4 : 3;
  const chunks: Uint8Array[] = [];

  for (let at = 8; at < png.length;) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));

    if (type === "IDAT") chunks.push(png.subarray(at + 8, at + 8 + length));
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(chunks));
  const stride = width * channels;
  const rows: Uint8Array[] = [];

  for (let y = 0, at = 0; at < raw.length; y++, at += stride + 1) {
    const row = Uint8Array.from(raw.subarray(at + 1, at + 1 + stride));
    const up = rows[y - 1] ?? new Uint8Array(stride);

    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? row[i - channels]! : 0;
      const b = up[i]!;
      const c = i >= channels ? up[i - channels]! : 0;
      const p = a + b - c;

      const nearest =
        Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c)
          ? a
          : Math.abs(p - b) <= Math.abs(p - c)
            ? b
            : c;

      const add = [0, a, b, (a + b) >> 1, nearest][raw[at]!]!;

      row[i] = (row[i]! + add) & 255;
    }

    rows.push(row);
  }

  return (x: number, y: number): [number, number, number] => {
    const row = rows[y]!;

    return [row[x * channels]!, row[x * channels + 1]!, row[x * channels + 2]!];
  };
};

const shoot = async (out: string, time = 0) =>
  pixels(
    (await renderFrames(out, { times: [time], colorScheme: "light", background: "#ffffff" }))
      .frames[0]!.png,
  );

describe("emboss inside a mirrored group", () => {
  const coin = (x: number, flip: boolean) => (
    <Group
      key={flip ? "flipped" : "plain"}
      offset={[x, 50]}
      scale={flip ? [-1, 1] : 1}
      origin="own"
      effects={[emboss({ depth: 4 })]}
    >
      <Shape geometry={circle(30)} fill="#C08040" />
    </Group>
  );

  const build = () => (
    <Group>
      {coin(50, false)}
      {coin(150, true)}
    </Group>
  );

  test("the filter sits outside the mirror, with its region in the parent's space", () => {
    const out = emit([200, 100], build);
    const mirrored = /<g filter="url\(#(\w+)\)">\s*<g[^>]*scale:-1 1/.exec(out);

    expect(mirrored).not.toBeNull();
    expect(out).toMatch(
      new RegExp(`<filter id="${mirrored![1]}" filterUnits="userSpaceOnUse" x="119" y="19"`),
    );
  });

  test.if(browser)("lights the mirrored content as it lights the plain one", async () => {
    const at = await shoot(emit([200, 100], build));
    const [plain, flipped] = [at(50, 50), at(150, 50)];

    expect(Math.max(...flipped)).toBeGreaterThan(100);

    for (let i = 0; i < 3; i++) expect(Math.abs(flipped[i]! - plain[i]!)).toBeLessThan(8);
  });
});

describe.if(browser)("a stroke drawn from 0", () => {
  test("paints nothing at draw 0, whatever its cap", async () => {
    const drawn = track(0).to(1, span(0, 1));

    const at = await shoot(
      emit([100, 100], () => (
        <Group>
          {(["round", "square"] as const).map((cap, i) => (
            <Group key={cap}>
              <Shape
                geometry={line([20, 20 + i * 40], [80, 20 + i * 40])}
                stroke={{ color: "#000000", width: 10, cap }}
                draw={drawn}
              />
              <Shape
                geometry={circle(8)}
                offset={[50, 30 + i * 40]}
                stroke={{ color: "#000000", width: 10, cap, dash: [4, 2] }}
                draw={drawn}
              />
            </Group>
          ))}
        </Group>
      )),
    );

    for (let y = 0; y < 100; y += 2)
      for (let x = 0; x < 100; x += 2) expect(at(x, y)).toEqual([255, 255, 255]);
  });
});

describe("blend under a clipped group", () => {
  const backdrop = <Shape geometry={rect(100, 60)} fill="#FFCC00" />;

  test("a lone blending child passes its blend to its group", () => {
    const out = emit([100, 60], () => (
      <Group>
        {backdrop}
        <Group key="clipped" offset={[20, 10]} clip={rect(40, 40)}>
          <Shape geometry={rect(60, 60)} fill="#3366FF" blend="multiply" />
        </Group>
      </Group>
    ));

    expect(out).toMatch(/<g [^>]*clip-path="url\(#\w+\)" style="mix-blend-mode:multiply">/);
    expect(out).not.toContain("isolation:isolate");
  });

  test("a group with other children still isolates them", () => {
    const out = emit([100, 60], () => (
      <Group key="clipped" clip={rect(40, 40)}>
        <Shape geometry={rect(60, 60)} fill="#3366FF" blend="multiply" />
        <Shape geometry={rect(10, 10)} fill="#FF0000" />
      </Group>
    ));

    expect(out).toContain("isolation:isolate");
    expect(out).toMatch(/<rect[^>]*style="mix-blend-mode:multiply"/);
  });

  test.if(browser)("multiplies with what is behind the group", async () => {
    const at = await shoot(
      emit([100, 60], () => (
        <Group>
          {backdrop}
          <Group offset={[20, 10]} clip={rect(40, 40)}>
            <Shape geometry={rect(60, 60)} fill="#3366FF" blend="multiply" />
          </Group>
        </Group>
      )),
    );

    // #FFCC00 × #3366FF = #335200.
    const [r, g, b] = at(40, 30);

    expect(Math.abs(r - 0x33)).toBeLessThan(3);
    expect(Math.abs(g - 0x52)).toBeLessThan(3);
    expect(b).toBeLessThan(3);
    expect(at(80, 30)).toEqual([255, 204, 0]);
  });
});

describe("motion scale with origin", () => {
  // A group whose box starts far left of its own [0, 0], like a paper with a wide hill.
  const content = (
    <>
      <Shape key="hill" geometry={rect(1200, 200)} offset={[-400, 0]} fill="#FFFFFF" />
      <Shape key="dot" geometry={rect(10, 10)} offset={[195, 95]} fill="#FF0000" />
    </>
  );

  const scaled = (motion: boolean, origin: Parameters<typeof Group>[0]["origin"]) =>
    made([400, 200], () =>
      motion ? (
        <Group key="g" origin={origin} motion={{ scale: track(1.05).to(1.1, span(0, 2)) }}>
          {content}
        </Group>
      ) : (
        <Group key="g" origin={origin} scale={1.05}>
          {content}
        </Group>
      ),
    );

  const dot = (model: ReturnType<typeof made>) =>
    placements(model, 0).find((placed) => placed.key.endsWith("dot"))!.box;

  test("pivots on origin exactly like the scale prop", () => {
    for (const origin of [[200, 100], { own: [200, 100] }, "center"] as const) {
      const [prop, motion] = [scaled(false, origin), scaled(true, origin)];

      expect(dot(motion)).toEqual(dot(prop));

      const pivot = (out: string) => /transform-origin:([^;"]*)/.exec(out)?.[1];
      expect(pivot(svg.emit(motion))).toBe(pivot(svg.emit(prop)));
    }
  });

  test("[x, y] is measured from the box's top-left, { own } from the node's own [0, 0]", () => {
    expect(dot(scaled(true, { own: [200, 100] })).x).toBeCloseTo(200 + (195 - 200) * 1.05);
    expect(dot(scaled(true, [200, 100])).x).toBeCloseTo(-200 + (195 + 200) * 1.05);
  });
});

describe("shape rule", () => {
  const ring = (rule?: "nonzero" | "evenodd") =>
    emit([100, 100], () => (
      <Shape
        geometry={merge(circle(40), circle(20))}
        offset={[50, 50]}
        fill="#000000"
        rule={rule}
      />
    ));

  test("emits fill-rule only when asked", () => {
    expect(ring()).not.toContain("fill-rule");
    expect(ring("evenodd")).toContain('fill-rule="evenodd"');
  });

  test.if(browser)("evenodd cuts the inner circle out of the ring", async () => {
    const evenodd = await shoot(ring("evenodd"));

    expect(evenodd(50, 50)).toEqual([255, 255, 255]);
    expect(evenodd(50, 20)).toEqual([0, 0, 0]);
  });
});

describe("emboss under a mirrored ancestor", () => {
  const flipped = (inner: SceneElement) => (
    <Group offset={[150, 50]} scale={[-1, 1]} origin="own">
      {inner}
      <Shape key="speck" geometry={rect(2, 2)} offset={[-70, -45]} fill="#000000" />
    </Group>
  );

  const plain = (inner: SceneElement) => <Group offset={[50, 50]}>{inner}</Group>;

  const pair = (inner: SceneElement) => () => (
    <Group>
      {plain(inner)}
      {flipped(inner)}
    </Group>
  );

  const lit = (build: () => SceneElement) => async () => {
    const at = await shoot(emit([200, 100], build));
    const [a, b] = [at(50, 50), at(150, 50)];

    expect(Math.max(...b)).toBeGreaterThan(100);

    for (let i = 0; i < 3; i++) expect(Math.abs(b[i]! - a[i]!)).toBeLessThan(8);
  };

  const group = (
    <Group key="lit" effects={[emboss({ depth: 4 })]}>
      <Shape geometry={circle(30)} fill="#C08040" />
    </Group>
  );

  const layered = (
    <Shape
      key="layered"
      geometry={circle(30)}
      fill={["#C08040", { paint: "#FFFFFF", effects: [emboss({ depth: 4 })] }]}
    />
  );

  test("the filter mirrors back, with its region in the mirrored space", () => {
    const out = emit([200, 100], pair(group));

    expect(out).toMatch(
      /<g transform="scale\(-1 1\)" filter="url\(#\w+\)">\s*<g transform="scale\(-1 1\)">/,
    );
  });

  test.if(browser)("an embossed group inside a mirrored group is lit", lit(pair(group)));

  test.if(browser)("an emboss paint layer inside a mirrored group is lit", lit(pair(layered)));
});
