import { describe, expect, test } from "bun:test";
import { calc, css, def, render, type Css } from "svg-motion";

const { add, sub, mul, div, sin, cos, clamp, min, max, length, angle } = calc;

const yaw = def.property("yaw", { syntax: "angle", inherits: true, initial: 0 });
const px = def.property("px", { syntax: "number", inherits: false, initial: 0 });
const py = def.property("py", { syntax: "number", inherits: false, initial: 0 });
const pz = def.property("pz", { syntax: "number", inherits: false, initial: 0 });

const style = (rule: Css) => {
  const svg = render({ width: 10, height: 10, duration: 1, title: "T", css: rule }, <g />);
  return svg.slice(svg.indexOf("<![CDATA[") + 9, svg.indexOf("]]>"));
};

const value = (expression: Css) => style(css`.d{v:${expression}}`).match(/\.d\{v:(.*)\}/)![1];

describe("calc", () => {
  test("the README orbit renders the same file as the hand-written css", () => {
    const built = css`.dot{translate:${add(length(100), mul(length(60), px, cos(yaw)))} 100px}`;
    const written = css`.dot{translate:calc(100px + 60px * ${px} * cos(${yaw})) 100px}`;
    expect(style(built)).toBe(style(written));
    expect(style(built)).toContain(".dot{translate:calc(100px + 60px * var(--p1) * cos(var(--p2))) 100px}");
  });

  test("properties read through the builder are registered once, under their render names", () => {
    const rule = style(css`.d{a:${mul(px, cos(yaw))};b:${mul(px, sin(yaw))}}`);
    expect(rule).toContain(".d{a:calc(var(--p1) * cos(var(--p2)));b:calc(var(--p1) * sin(var(--p2)))}");
    expect(rule.match(/@property/g)).toHaveLength(2);
  });

  test("calc() wraps arithmetic once, and nothing else", () => {
    expect(value(length(4))).toBe("4px");
    expect(value(angle(-22.5))).toBe("-22.5deg");
    expect(value(cos(yaw))).toBe("cos(var(--p1))");
    expect(value(cos(add(yaw, angle(90))))).toBe("cos(var(--p1) + 90deg)");
    expect(value(clamp(0, add(px, 1), 1))).toBe("clamp(0, var(--p1) + 1, 1)");
    expect(value(mul(sin(yaw), 2))).toBe("calc(sin(var(--p1)) * 2)");
  });

  test("length() and angle() of an expression multiply by one unit", () => {
    expect(value(length(mul(px, 3)))).toBe("calc(var(--p1) * 3 * 1px)");
    expect(value(angle(px))).toBe("calc(var(--p1) * 1deg)");
  });

  test("parentheses appear only where dropping them changes the value", () => {
    expect(value(add(px, mul(py, 2)))).toBe("calc(var(--p1) + var(--p2) * 2)");
    expect(value(mul(add(px, py), 2))).toBe("calc((var(--p1) + var(--p2)) * 2)");
    expect(value(sub(px, sub(py, 1)))).toBe("calc(var(--p1) - (var(--p2) - 1))");
    expect(value(sub(sub(px, py), 1))).toBe("calc(var(--p1) - var(--p2) - 1)");
    expect(value(add(px, sub(py, 1)))).toBe("calc(var(--p1) + var(--p2) - 1)");
    expect(value(div(1, mul(px, py)))).toBe("calc(1 / (var(--p1) * var(--p2)))");
    expect(value(div(add(px, 150), 300))).toBe("calc((var(--p1) + 150) / 300)");
    expect(value(sub(px, -0.5))).toBe("calc(var(--p1) - -0.5)");
  });

  test("min and max take any number of operands", () => {
    expect(value(min(length(4), mul(length(2), px), length(8)))).toBe("min(4px, 2px * var(--p1), 8px)");
    expect(value(max(px, 0))).toBe("max(var(--p1), 0)");
  });

  test("the manifold projection renders one calc() per value", () => {
    const pitch = angle(22);
    const x = sub(mul(px, cos(yaw)), mul(pz, sin(yaw)));
    const z = add(mul(px, sin(yaw)), mul(pz, cos(yaw)));
    const up = add(mul(py, cos(pitch)), mul(z, sin(pitch)));
    const depth = sub(mul(z, cos(pitch)), mul(py, sin(pitch)));
    const size = div(720, add(720, depth));
    const fog = clamp(0.15, sub(0.95, mul(div(add(depth, 150), 300), 0.75)), 1);
    const rule = style(css`.dot{translate:${length(mul(x, 1.3, size))} ${length(mul(up, -1.3, size))};scale:${size};opacity:${fog}}`);

    const Z = "(var(--p1) * sin(var(--p2)) + var(--p3) * cos(var(--p2)))";
    const depthText = `${Z} * cos(22deg) - var(--p4) * sin(22deg)`;
    expect(rule).toContain(`scale:calc(720 / (720 + ${depthText}))`);
    expect(rule).toContain(`opacity:clamp(0.15, 0.95 - (${depthText} + 150) / 300 * 0.75, 1)`);
    const values = rule.match(/\.dot\{translate:(.*)\}/)![1]!.split(/;\w+:| (?=calc\()/);
    expect(values.map((text) => text.match(/calc\(/g)?.length ?? 0)).toEqual([1, 1, 1, 0]);
  });

  test("tiny literals keep their meaning instead of rounding to 0", () => {
    expect(value(div(1, 0.0004))).toBe("calc(1 / 0.0004)");
    expect(value(mul(px, 0.0004))).toBe("calc(var(--p1) * 0.0004)");
    expect(value(mul(px, 1.23456789))).toBe("calc(var(--p1) * 1.23457)");
    expect(value(length(0.00002))).toBe("0.00002px");
  });

  test("a literal that cannot be written is refused", () => {
    expect(() => div(1, Number.NaN)).toThrow();
    expect(() => style(css`.d{v:${div(1, Number.POSITIVE_INFINITY)}}`)).toThrow();
  });
});
