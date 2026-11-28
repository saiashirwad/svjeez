import { describe, expect, test } from "bun:test";
import {
  emboss,
  font,
  Group,
  linear,
  noise,
  none,
  rect,
  scene,
  shadow,
  Shape,
  span,
  Text,
  tokens,
  track,
  ease,
  circle,
  type SceneElement,
} from "svjeez";
import { check, svg, SceneError, type Model } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts";

const mono = await font.load(fontFixture("SpaceMono-Regular"));

const theme = tokens({
  light: { paper: "#F4EEDD", ink: "#1D58A8" },
  dark: { paper: "#151515", ink: "#88AAFF" },
});

const made = (build: () => SceneElement, duration = 4): Model.Scene =>
  scene({ size: [200, 100], duration, title: "Test", still: 2, theme }, build);

const emitted = (model: Model.Scene): string => svg.emit(model).replace(/>\s+</g, "><");

const paper = noise({ frequency: 0.02, octaves: 2, seed: 7, ramp: ["#0D2F63", "#1D58A8"] });

const sheet = (fill: Parameters<typeof Shape>[0]["fill"], extra = {}) =>
  emitted(made(() => <Shape geometry={rect(40, 20)} at={[10, 10]} fill={fill} {...extra} />));

describe("noise()", () => {
  test("fills a shape with turbulence mapped through the ramp and cut to the shape", () => {
    const out = sheet(paper);

    expect(out).toContain(
      '<feTurbulence type="fractalNoise" numOctaves="2" seed="7" result="z0n" baseFrequency="0.02"/><feFlood result="z0c0" flood-color="#0D2F63"/>',
    );
    expect(out).toContain(
      '<feColorMatrix in="z0n" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="z0w1"/><feFlood result="z0f1" flood-color="#1D58A8"/>',
    );
    expect(out).toContain('<feComposite in="z0c1" in2="SourceGraphic" operator="in"/></filter>');
    expect(out).toMatch(/<rect [^>]*fill="#0D2F63" filter="url\(#[a-z0-9]+\)"/);
  });

  test("a ramp of [offset, color] pairs weights each segment between its offsets", () => {
    const out = sheet(
      noise({
        frequency: [0.9, 0.06],
        seed: 2,
        type: "turbulence",
        stitch: true,
        ramp: [
          [0.25, "#000000"],
          [0.75, "#ffffff80"],
        ],
      }),
    );

    expect(out).toContain('type="turbulence" numOctaves="3" seed="2" stitchTiles="stitch"');
    expect(out).toContain('baseFrequency="0.9 0.06"');
    expect(out).toContain('values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 2 -0.5"');
    expect(out).toContain('flood-color="#FFFFFF80"');
  });

  test("an animated frequency writes SMIL on baseFrequency", () => {
    const one = sheet(
      noise({
        frequency: track(0.01).to(0.03, span(0, 2), ease.linear),
        seed: 1,
        ramp: ["#000000", "#ffffff"],
      }),
    );

    expect(one).toMatch(
      /<feTurbulence [^>]*baseFrequency="[\d.]+"><animate [^>]*attributeName="baseFrequency" values="0.01;0.03/,
    );

    const two = sheet(
      noise({
        frequency: track<[number, number]>([0.01, 0.02]).to([0.03, 0.08], span(0, 2), ease.linear),
        seed: 1,
        ramp: ["#000000", "#ffffff"],
      }),
    );

    expect(two).toMatch(/attributeName="baseFrequency" values="0.01 0.02;0.03 0.08/);
  });

  test("tokens in the ramp stay live CSS colors", () => {
    const out = sheet(noise({ frequency: 0.02, seed: 7, ramp: [theme.paper, theme.ink] }));

    expect(out).toContain('flood-color="var(--paper)"');
    expect(out).toContain('flood-color="var(--ink)"');
    expect(out).toMatch(/--paper:#151515/i);
  });

  test("paints <Text> too", () => {
    const out = emitted(
      made(() => (
        <Text font={mono} size={20} at={[10, 40]} fill={paper}>
          Kraft
        </Text>
      )),
    );

    expect(out).toContain("<feTurbulence");
    expect(out).toMatch(/<text [^>]*filter="url\(#/);
  });

  test("is checked like a solid fill and adds no warnings", () => {
    const model = made(() => (
      <Group>
        <Shape geometry={rect(200, 100)} fill={theme.paper} />
        <Shape geometry={rect(40, 20)} at={[10, 10]} fill={paper} />
      </Group>
    ));

    expect(
      check(model).problems.filter((found) => found.severity !== "info" && found.code !== "static"),
    ).toEqual([]);
  });

  test("bad options throw SceneErrors that say what to give", () => {
    expect(() => noise({ frequency: -1, seed: 1, ramp: ["#000", "#fff"] })).toThrow(
      /noise\(\) needs a frequency of 0 or more/,
    );
    expect(() => noise({ frequency: 0.1, seed: 1.5, ramp: ["#000", "#fff"] })).toThrow(
      /whole-number seed/,
    );
    expect(() => noise({ frequency: 0.1, seed: 1, octaves: 0, ramp: ["#000", "#fff"] })).toThrow(
      /1 or more octaves/,
    );
    expect(() => noise({ frequency: 0.1, seed: 1, ramp: ["#000"] })).toThrow(SceneError);
    expect(() =>
      made(() => (
        <Text font={mono} size={20} at={[10, 40]} fill={paper} stroke={{ color: "#000" }}>
          Kraft
        </Text>
      )),
    ).toThrow(/noise\(\) fill and a stroke/);
    expect(() =>
      made(() => <Shape geometry={rect(10, 10)} fill={track<typeof paper | "#000">(paper)} />),
    ).toThrow(/a noise\(\) paint where it can't go/);
  });
});

describe("noise rotate", () => {
  const turn = (rotate: number) =>
    noise({ frequency: 0.02, octaves: 2, seed: 7, rotate, ramp: ["#0D2F63", "#1D58A8"] });

  test("turns the noise field about the box center, and the shape back, so only the noise turns", () => {
    const out = sheet(turn(30));

    expect(out).toMatch(
      /<g transform="translate\(10 10\)" filter="url\(#[a-z0-9]+\)" style="transform-origin:30px 20px;rotate:30deg"><rect [^>]*style="transform-origin:20px 10px;rotate:-30deg"\/><\/g>/,
    );
  });

  test("rotate 0 writes exactly what no rotate writes", () => {
    expect(sheet(turn(0))).toBe(sheet(paper));
  });

  test("turns a noise layer and a noise <Text> fill the same way", () => {
    const model = made(() => (
      <Group>
        <Shape key="part" geometry={rect(40, 20)} fill={["#FF0000", { paint: turn(45) }]} />
        <Text key="word" font={mono} size={20} at={[10, 40]} fill={turn(-20)}>
          Kraft
        </Text>
      </Group>
    ));

    const [part, word] = model.root.children;

    expect(part?.kind === "group" && part.children[1]).toMatchObject({
      key: "part#fill2",
      effects: [],
      children: [
        { key: "part#fill2#noise", layers: [{ rotate: 45 }], effects: [{ kind: "noise" }] },
      ],
    });
    expect(word).toMatchObject({
      kind: "group",
      children: [
        {
          layers: [{ rotate: -20 }],
          children: [{ kind: "text", key: "word#grain", layers: [{ rotate: 20 }], effects: [] }],
        },
      ],
    });
  });

  test("a bad rotate throws", () => {
    expect(() => turn(Number.NaN)).toThrow(/noise\(\) needs rotate as a finite number of degrees/);
  });
});

describe("layered fills", () => {
  const base = linear.across({ angle: 90, stops: ["#FF0000", "#0000FF"] });

  test("paint bottom to top as copies of the shape, each with its blend and opacity", () => {
    const model = made(() => (
      <Shape
        key="part"
        geometry={rect(40, 20)}
        at={[10, 10]}
        fill={[base, { paint: paper, blend: "multiply", opacity: 0.5 }]}
        stroke={{ color: "#000000", width: 2 }}
      />
    ));

    const part = model.root.children[0]!;

    expect(part.kind).toBe("group");

    if (part.kind !== "group") return;
    expect(part.children.map((child) => child.key)).toEqual([
      "part#fill1",
      "part#fill2",
      "part#stroke1",
    ]);
    expect(part.children[1]).toMatchObject({ blend: "multiply", layers: [{ opacity: 0.5 }] });
    expect(part.children[1]!.effects[0]!.kind).toBe("noise");

    const out = emitted(model);

    expect(out.indexOf("linearGradient")).toBeLessThan(out.indexOf("mix-blend-mode:multiply"));
  });

  test("an under stroke goes beneath the fill layers", () => {
    const model = made(() => (
      <Shape
        key="part"
        geometry={rect(40, 20)}
        at={[10, 10]}
        fill={[base, "#00000040"]}
        stroke={{ color: "#000000", width: 2, under: true }}
      />
    ));

    const part = model.root.children[0]!;

    expect(part.kind === "group" && part.children.map((child) => child.key)).toEqual([
      "part#stroke1",
      "part#fill1",
      "part#fill2",
    ]);
  });

  test("a noise fill and a stroke split, so the noise stays off the stroke", () => {
    const part = made(() => (
      <Shape key="p" geometry={rect(40, 20)} fill={paper} stroke={{ color: "#000000" }} />
    )).root.children[0]!;

    expect(part.kind).toBe("group");
  });

  test("a single paint, bare or in a one-item list, writes what it always has", () => {
    const one = sheet("#FF0000", { stroke: { color: "#000000" } });

    expect(sheet(["#FF0000"], { stroke: { color: ["#000000"] } })).toBe(one);
    expect(one).not.toContain("<g");
  });

  test("a layer's effects light that layer alone, after its noise", () => {
    const model = made(() => (
      <Shape
        key="part"
        geometry={rect(40, 20)}
        fill={["#FF0000", { paint: paper, effects: [emboss({ depth: 1.8 })] }, "#00000020"]}
      />
    ));

    const part = model.root.children[0]!;

    expect(
      part.kind === "group" && part.children.map((child) => child.effects.map((e) => e.kind)),
    ).toEqual([[], ["noise", "emboss"], []]);
    expect(emitted(model).match(/<filter /g)).toHaveLength(1);
  });

  test("effects on a single layer still split it off as a copy", () => {
    const part = made(() => (
      <Shape
        key="part"
        geometry={rect(40, 20)}
        fill={[{ paint: "#FF0000", effects: [emboss()] }]}
      />
    )).root.children[0]!;

    expect(part.kind === "group" && part.children[0]!.effects[0]!.kind).toBe("emboss");
  });

  test("layer effects that are not a list, or not effects, throw", () => {
    expect(() =>
      // @ts-expect-error effects is a list
      sheet(["#000", { paint: "#fff", effects: emboss() }]),
    ).toThrow(/effects of fill layer 2 .* need to be a list/);
    expect(() =>
      // @ts-expect-error not an effect
      sheet(["#000", { paint: "#fff", effects: [{ kind: "glow" }] }]),
    ).toThrow(/effects on fill layer 2 .* takes blur\(\)/);
  });

  test("a layered stroke on <Text> or a bad layer opacity says what to do", () => {
    expect(() =>
      made(() => (
        <Text font={mono} size={20} at={[10, 40]} fill="#000" stroke={{ color: ["#000", "#fff"] }}>
          Hi
        </Text>
      )),
    ).toThrow(/layered stroke, which only a <Shape> takes/);
    expect(() => sheet(["#000", { paint: "#fff", opacity: 2 }])).toThrow(
      /opacity of fill layer 2 .* needs a number from 0 to 1/,
    );
  });
});

describe("none", () => {
  test("a node painted none is left out, with no warning and no error", () => {
    const model = made(() => (
      <Group>
        <Shape geometry={rect(200, 100)} fill={theme.paper} />
        <Shape key="gone" geometry={rect(10, 10)} at={[10, 10]} fill={none} />
        <Shape
          key="also"
          geometry={rect(10, 10)}
          at={[10, 10]}
          fill={none}
          stroke={{ color: none }}
        />
        <Text key="words" font={mono} size={12} at={[10, 40]} fill={none}>
          Hi
        </Text>
      </Group>
    ));

    const out = emitted(model);

    expect(out.split("<rect").length - 1).toBe(1);
    expect(out).not.toContain("<text");
    expect(
      check(model).problems.filter((found) => found.severity !== "info" && found.code !== "static"),
    ).toEqual([]);
  });

  test("a none stroke drops just the stroke, a none fill just the fill", () => {
    expect(sheet("#FF0000", { stroke: { color: none, width: 4 } })).toBe(sheet("#FF0000"));

    const stroked = emitted(
      made(() => (
        <Shape geometry={rect(40, 20)} at={[10, 10]} fill={none} stroke={{ color: "#000000" }} />
      )),
    );

    expect(stroked).toContain('fill="none"');
    expect(stroked).toContain('stroke="#000000"');
  });

  test("none in a track throws", () => {
    expect(() =>
      made(() => (
        <Shape
          geometry={rect(10, 10)}
          fill={track<"#000000" | typeof none>("#000000").set(none, span(1))}
        />
      )),
    ).toThrow(/a none paint where it can't go/);
  });
});

describe("emboss()", () => {
  test("lights the node's alpha as a bump map, kept inside it", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={circle(30)}
          at={[100, 50]}
          stroke={{ color: "#C08040", width: 8 }}
          effects={[emboss({ light: { azimuth: 200, elevation: 30 }, depth: 4, specular: 0.8 })]}
        />
      )),
    );

    expect(out).toContain('<feGaussianBlur in="SourceGraphic" result="z0h" stdDeviation="1.5"/>');
    expect(out).toContain(
      '<feDiffuseLighting in="z0h" surfaceScale="4" diffuseConstant="2" lighting-color="#FFFFFF" result="z0d"><feDistantLight azimuth="200" elevation="30"/></feDiffuseLighting>',
    );
    expect(out).toContain(
      '<feComposite in="z0d" in2="SourceGraphic" operator="arithmetic" k1="1" result="z0s"/>',
    );
    expect(out).toContain('<feSpecularLighting in="z0h" surfaceScale="4" specularConstant="0.8"');
    expect(out).toContain('<feComposite in="z0g" in2="SourceGraphic" operator="in" result="z0k"/>');
  });

  test("chains after other effects and drops its highlight at specular 0", () => {
    const out = emitted(
      made(() => (
        <Shape
          geometry={rect(40, 20)}
          at={[10, 10]}
          fill="#C08040"
          effects={[shadow({ color: "#000000", blur: 2 }), emboss({ specular: 0 })]}
        />
      )),
    );

    expect(out).toContain('<feDropShadow result="e0"');
    expect(out).toContain('<feGaussianBlur in="e0" result="z1h"');
    expect(out).not.toContain("feSpecularLighting");
  });

  test("bad options throw SceneErrors", () => {
    const bad = (effect: ReturnType<typeof emboss>) => () =>
      made(() => <Shape geometry={rect(10, 10)} fill="#000" effects={[effect]} />);

    expect(bad(emboss({ depth: -1 }))).toThrow(
      /emboss depth .* needs a number of 0 or more, got -1/,
    );
    expect(bad(emboss({ light: { elevation: 0 } }))).toThrow(/elevation .* degrees above 0/);
  });
});
