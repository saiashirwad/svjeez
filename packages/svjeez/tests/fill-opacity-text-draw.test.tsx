/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import {
  Group,
  Shape,
  Text,
  circle,
  defaults,
  font,
  param,
  parse,
  pattern,
  radial,
  rect,
  scene,
  span,
  track,
} from "svjeez";
import { validateSvg } from "svjeez/frames";
import { check, svg } from "svjeez/tools";

const regular = await font.load(new URL("./fixtures/ABeeZee-Regular.ttf", import.meta.url));

describe("fillOpacity, Text draw, radial.across, pattern.rotate, Child, exports", () => {
  test("fillOpacity animates fill independently of stroke and satisfies visible-at-zero", () => {
    const model = scene(
      { size: [200, 100], duration: 3, loop: false, title: "FillOpacity" },
      () => (
        <Group>
          <Shape
            key="petal"
            geometry={rect(80, 40)}
            at={[60, 30]}
            fill="#CC3355"
            fillOpacity={track(0).to(1, span(1.2, 0.8))}
            stroke={{ color: "#111111", width: 2 }}
            draw={track(0).to(1, span(0, 1.2))}
          />
        </Group>
      ),
    );

    const out = svg.emit(model);
    expect(out).toContain("fill-opacity");
    expect(validateSvg(out).errors).toEqual([]);
    expect(check(model).problems.filter((p) => p.code === "visible-at-zero")).toEqual([]);
  });

  test("Text draw traces glyph outlines with stroke and fillOpacity while keeping check coverage", () => {
    const model = scene({ size: [300, 120], duration: 3, loop: false, title: "TextDraw" }, () => (
      <Group>
        <Shape geometry={rect(300, 120)} fill="#FFFFFF" />
        <Text
          key="names"
          font={regular}
          size={40}
          at={[150, 60]}
          anchor="center"
          fill="#222222"
          fillOpacity={track(0).to(1, span(1.5, 0.6))}
          stroke={{ color: "#222222", width: 1.5 }}
          draw={track(0).to(1, span(0.1, 1.4))}
        >
          Ananya
        </Text>
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).toContain("<path");
    expect(out).toContain('aria-label="Ananya"');
    expect(out).toContain("fill-opacity");
    expect(validateSvg(out).errors).toEqual([]);
    expect(check(model).problems.filter((p) => p.severity === "error")).toEqual([]);
  });

  test("radial.across supports fit: 'inside' and fractional center", () => {
    const model = scene({ size: [200, 200], duration: 1, title: "Radial" }, () => (
      <Group>
        <Shape
          geometry={circle(50)}
          at={[100, 100]}
          anchor="center"
          fill={radial.across({
            fit: "inside",
            center: [0.3, 0.4],
            stops: ["#FFCC00", "#FFCC0000"],
          })}
        />
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).toContain('cx="80"');
    expect(out).toContain('cy="90"');
    expect(out).toContain('r="30"');

    const centered = scene({ size: [200, 200], duration: 1, title: "RadialCenter" }, () => (
      <Group>
        <Shape
          geometry={circle(50)}
          at={[100, 100]}
          anchor="center"
          fill={radial.across({ fit: "inside", stops: ["#FFCC00", "#FFCC0000"] })}
        />
      </Group>
    ));

    expect(svg.emit(centered)).toContain('r="50"');
  });

  test("pattern({ rotate }) emits patternTransform", () => {
    const tile = pattern({
      size: [16, 16],
      rotate: 45,
      tile: <Shape geometry={rect(8, 2)} fill="#999999" />,
    });

    const model = scene({ size: [100, 100], duration: 1, title: "Pattern" }, () => (
      <Group>
        <Shape geometry={rect(100, 100)} fill={tile} />
      </Group>
    ));

    const out = svg.emit(model);
    expect(out).toContain('patternTransform="rotate(45)"');
    expect(validateSvg(out).errors).toEqual([]);
  });

  test("dashed stroke with draw uses 'Flat caps' wording rather than 'Butt caps'", () => {
    const model = scene({ size: [100, 100], duration: 2, loop: false, title: "Caps" }, () => (
      <Group>
        <Shape
          geometry={rect(60, 20)}
          at={[20, 40]}
          stroke={{ color: "#111111", width: 2, dash: [4, 4], cap: "round" }}
          draw={track(0).to(1, span(0, 1))}
        />
      </Group>
    ));

    const messages = check(model)
      .problems.map((p) => p.message)
      .join("\n");

    expect(messages).not.toContain("Butt caps");
    expect(messages).toContain("Flat caps");
  });

  test("Child accepts boolean and empty string, and root exports defaults and parse", () => {
    const show = false;
    const empty: string = "";
    const flag = true;

    const model = scene({ size: [100, 100], duration: 1, title: "Child" }, () => (
      <Group>
        {show && <Shape geometry={rect(10, 10)} fill="#000000" />}
        {empty && <Shape geometry={rect(10, 10)} fill="#000000" />}
        {flag}
        <Shape geometry={rect(20, 20)} fill="#000000" />
      </Group>
    ));

    expect(model.root.children).toHaveLength(1);

    const schema = { name: param.text("Maya"), count: param.count(3, { max: 10 }) };
    expect(defaults(schema)).toEqual({ name: "Maya", count: 3 });
    expect(parse(schema, { count: 5 })).toEqual({ name: "Maya", count: 5 });
  });
});
