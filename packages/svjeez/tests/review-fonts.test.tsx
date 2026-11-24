import { describe, expect, test } from "bun:test";
import { Run, Text, font, scene } from "svjeez";
import { svg } from "svjeez/tools";
import { fontFixture } from "../../../fixtures/fonts";

const size: [number, number] = [200, 50];

const emit = (face: ReturnType<typeof font.system>, prefix?: string) =>
  svg.emit(
    scene({ size, duration: 1, title: "F", desc: "D" }, () => (
      <Text key="t" font={face} size={12} fill="#000000">
        <Run advances={[6, 6]}>ab</Run>
      </Text>
    )),
    prefix === undefined ? {} : { prefix },
  );

describe("font families in svg", () => {
  test("a CSS generic family is emitted as a keyword, not a quoted name", () => {
    expect(emit(font.system("monospace"))).toMatch(/font-family="monospace"/);
    expect(emit(font.system("system-ui"))).not.toContain("'system-ui'");
  });

  test("a named system family stays quoted with its fallback", () => {
    expect(emit(font.system("Helvetica Neue"))).toContain("'Helvetica Neue', sans-serif");
  });

  test("a prefix leaves system families alone", () => {
    const out = emit(font.system("Helvetica Neue"), "x");

    expect(out).toContain("'Helvetica Neue'");
    expect(out).not.toContain("xHelvetica");
  });

  test("a prefix renames an embedded family", async () => {
    const sans = await font.load(fontFixture("ABeeZee-Regular"));

    expect(emit(sans, "x")).toContain("'xABeeZee'");
  });
});

describe("runs with supplied advances", () => {
  test("skip the glyph-coverage check", async () => {
    const sans = await font.load(fontFixture("ABeeZee-Regular"));

    const draw = (advances?: number[]) => () =>
      scene({ size, duration: 1, title: "F", desc: "D" }, () => (
        <Text key="t" font={sans} size={12} fill="#000000">
          <Run advances={advances}>a日b</Run>
        </Text>
      ));

    expect(draw([6, 12, 6])).not.toThrow();
    expect(draw()).toThrow("no glyph");
  });
});
