import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { black, faces, fixture, jetbrains, sans, scene } from "../helpers/font";

describe("fontFamily", () => {
  test("text that forms ligatures embeds the whole font, so the browser can still form them", () => {
    expect(scene(<text fontFamily={black}>fi</text>)).toContain(black.href);
  });

  test("text that could meet contextual alternates or mark positioning embeds the whole font", () => {
    expect(scene(<text fontFamily={jetbrains}>a // b</text>)).toContain(jetbrains.href);
    expect(scene(<text fontFamily={sans}>{"e\u0301"}</text>)).toContain(sans.href);
    expect(scene(<text fontFamily={jetbrains}>POST /login</text>)).not.toContain(jetbrains.href);
  });

  test("with ligatures off, the font still cuts down", async () => {
    const plain = font(await readFile(fixture("ArchivoBlack-Regular")), { ligatures: false });
    expect(scene(<text fontFamily={plain}>fi</text>)).not.toContain(plain.href);
    const code = font(await readFile(fixture("JetBrainsMono")), { ligatures: false });
    const svg = scene(<text fontFamily={code}>{"a // b => c"}</text>);
    expect(svg).not.toContain(code.href);
    const cut = font(Buffer.from(/base64,([^)]+)\)/.exec(svg)![1]!, "base64"));
    expect(cut.has("=") && cut.has(">") && cut.has("/")).toBe(true);
  });

  test("subset: false embeds the whole file", async () => {
    const whole = font(await readFile(fixture("ABeeZee-Regular")), { subset: false });
    expect(scene(<text fontFamily={whole}>Hi</text>)).toContain(whole.href);
  });

  test("a later copy of the same file with subset: false still embeds it whole", async () => {
    const whole = font(await readFile(fixture("ABeeZee-Regular")), { subset: false });

    const svg = scene(
      <>
        <text fontFamily={sans}>A</text>
        <text fontFamily={whole}>B</text>
      </>,
    );

    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
    expect(svg).toContain(whole.href);
  });
});
