import { describe, expect, test } from "bun:test";
import { Align, Group, Shape, Stack, morph, rect, ref, span } from "svjeez";
import { SceneError, svg, type Model } from "svjeez/tools";
import { Tex } from "../src/index.ts";
import { all, find, made } from "./helpers.ts";

const fillOf = (node: Model.SceneNode) => (node.kind === "shape" ? node.fill : undefined);

const nodeOf = (error: Error | undefined) => (error instanceof SceneError ? error.node : undefined);

const formula = String.raw`\textcolor{a}{a^2} + \cssId{cross}{2ab} + b^2`;

describe("<Tex>", () => {
  test("draws one keyed shape per glyph, counting repeats", () => {
    const model = made(() => (
      <Tex key="eq" size={40} at={[10, 20]} fill="#000000" colors={{ a: "#2F6FEB" }}>
        {formula}
      </Tex>
    ));

    const root = find(model, "eq");
    const keys = all(root).map((node) => node.key.slice(root.key.length + 1));

    expect(keys).toEqual([
      "",
      "a",
      "2",
      "+",
      "cross",
      "cross/2",
      "cross/a",
      "cross/b",
      "+#2",
      "b",
      "2#2",
    ]);
  });

  test("paints \\textcolor names from colors and the rest with fill", () => {
    const model = made(() => (
      <Tex key="eq" size={40} fill="#000000" colors={{ a: "#2F6FEB" }}>
        {formula}
      </Tex>
    ));

    const fill = (key: string) => JSON.stringify(fillOf(find(model, key)));

    expect(fill("eq/a")).not.toEqual(fill("eq/b"));
    expect(fill("eq/b")).toEqual(fill("eq/+"));
  });

  test("a hex color in \\color needs no colors entry", () => {
    const model = made(() => (
      <Tex key="eq" size={40} fill="#000000">
        {String.raw`\textcolor{#FF0000}{x}`}
      </Tex>
    ));

    expect(fillOf(find(model, "eq/x"))).toEqual([1, 0, 0, 1]);
  });

  test("an unknown color name says what to give", () => {
    expect(() =>
      made(() => (
        <Tex size={40} fill="#000000">
          {String.raw`\textcolor{accent}{x}`}
        </Tex>
      )),
    ).toThrow("which its colors don't name. Give it colors={{ accent: theme.blue }}");
  });

  test("bad TeX is a SceneError naming <Tex> and the source", () => {
    let error: Error | undefined;

    try {
      made(() => (
        <Tex size={40} fill="#000000">
          {String.raw`\frac{1}`}
        </Tex>
      ));
    } catch (thrown) {
      if (thrown instanceof Error) error = thrown;
    }

    expect(error).toBeInstanceOf(SceneError);
    expect(String(error)).toContain("<Tex> can't read");
    expect(nodeOf(error)).toBe("<Tex>");
  });

  test("anchor places the box: center puts the middle of the formula on at", () => {
    const box = Tex.measure("x+y", { size: 40, anchor: "center" });

    expect(box.x).toBeCloseTo(-box.width / 2);
    expect(box.y).toBeCloseTo(-box.height / 2);
    expect(Tex.measure("x+y", { size: 40, anchor: "baseline-left" }).baseline).toBeCloseTo(0);
  });

  test("measure finds parts and names them when one is missing", () => {
    const measured = Tex.measure(formula, { size: 40 });
    const cross = measured.part("cross");

    expect(cross.width).toBeGreaterThan(30);
    expect(cross.x).toBeGreaterThan(measured.x);
    expect(() => measured.part("nope")).toThrow('Its parts are "cross".');
  });

  test("two \\cssId parts with one name are refused", () => {
    expect(() =>
      made(() => (
        <Tex size={40} fill="#000000">
          {String.raw`\cssId{p}{a} + \cssId{p}{b}`}
        </Tex>
      )),
    ).toThrow('names two parts "p"');
  });

  test("a part is a ref part: anchors and Align find it", () => {
    const eq = ref("eq");

    const model = made(() => (
      <Group>
        <Tex ref={eq} size={40} at={[20, 40]} fill="#000000" colors={{ a: "#2F6FEB" }}>
          {formula}
        </Tex>
        <Align to={eq.part("cross")} place="bottom">
          <Shape key="mark" geometry={rect(10, 4)} fill="#FF0000" />
        </Align>
      </Group>
    ));

    expect(find(model, "mark").box.width).toBe(10);
  });

  test("sits in a Stack like any node", () => {
    const model = made(() => (
      <Stack direction="row" gap={10} at={[10, 10]}>
        <Shape key="left" geometry={rect(20, 20)} fill="#000000" />
        <Tex key="eq" size={30} fill="#000000">
          x^2
        </Tex>
      </Stack>
    ));

    expect(svg.emit(model)).toContain("<path");
  });

  test("morph() matches glyphs by key: kept glyphs move, new ones enter", () => {
    const model = made(() =>
      morph(
        <Tex size={40} at={[10, 40]} fill="#000000">
          {"(a+b)^2"}
        </Tex>,
        <Tex size={40} at={[10, 40]} fill="#000000">
          {"a^2+2ab+b^2"}
        </Tex>,
        span(1, 1),
      ),
    );

    expect(svg.emit(model)).toContain("@keyframes");
    expect(all(model.root).filter((node) => node.kind === "shape").length).toBeGreaterThan(8);
  });

  test("write draws each glyph's outline, then fills it", () => {
    const model = made(() => (
      <Tex key="eq" size={40} fill="#000000" write={span(0.5, 1.5)}>
        {"x+y"}
      </Tex>
    ));

    expect(find(model, "eq/writing").kind).toBe("group");
    expect(svg.emit(model)).toContain("@keyframes");
  });

  test("stretchy braces, roots and fractions draw", () => {
    expect(() =>
      made(() => (
        <Tex size={30} fill="#000000">
          {String.raw`\underbrace{x+y}_{n} = \sqrt{\frac{1}{2}} \left(\frac{a}{b}\right)`}
        </Tex>
      )),
    ).not.toThrow();
  });

  test("empty source and a bad size say so", () => {
    expect(() =>
      made(() => (
        <Tex size={30} fill="#000000">
          {" "}
        </Tex>
      )),
    ).toThrow("<Tex> holds no TeX source.");
    expect(() =>
      made(() => (
        <Tex size={0} fill="#000000">
          x
        </Tex>
      )),
    ).toThrow("needs a size above 0");
  });
});
