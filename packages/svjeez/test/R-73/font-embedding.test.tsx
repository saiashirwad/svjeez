import { describe, expect, test } from "bun:test";
import { readFile } from "node:fs/promises";
import { font } from "svjeez";
import { code, flowchart } from "svjeez/extras";
import { faces, fixture, italic, mono, sans, scene } from "../helpers/font";

describe("fontFamily", () => {
  test("embeds a used font once", () => {
    const svg = scene(
      <>
        <text fontFamily={sans}>One</text>
        <text fontFamily={sans}>Two</text>
      </>,
    );

    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("a family embeds every face under its name", () => {
    const svg = scene(<text fontFamily={font.family(sans, italic)}>Hi</text>);
    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal", "'ABeeZee' 400 italic"]);
  });

  test("an unused font is not embedded", () => {
    void sans;
    expect(scene(<text fontFamily="monospace">Hi</text>)).not.toContain("@font-face");
  });

  test("works on a group, so its text inherits the font", () => {
    expect(
      faces(
        scene(
          <g fontFamily={mono}>
            <text>Hi</text>
          </g>,
        ),
      ),
    ).toEqual(["'Space Mono' 400 normal"]);
  });

  test("the same file loaded twice embeds once", async () => {
    const again = await font.load(fixture("ABeeZee-Regular"));

    const svg = scene(
      <>
        <text fontFamily={sans}>A</text>
        <text fontFamily={again}>B</text>
      </>,
    );

    expect(faces(svg)).toEqual(["'ABeeZee' 400 normal"]);
  });

  test("two different files claiming one family slot is an error", async () => {
    const impostor = font(await readFile(fixture("SpaceMono-Regular")), { family: "ABeeZee" });
    expect(() =>
      scene(
        <>
          <text fontFamily={sans}>A</text>
          <text fontFamily={impostor}>B</text>
        </>,
      ),
    ).toThrow("Two different fonts claim 'ABeeZee' 400 normal");
  });

  test("code() embeds the monospaced font once", () => {
    const block = code("let x = 1", { font: mono, fontSize: 20 });
    expect(faces(scene(block.node))).toEqual(["'Space Mono' 400 normal"]);
  });

  test("diagram chips embed the font once", () => {
    expect(faces(scene(flowchart({ nodes: { a: "A" }, edges: [] }, { font: sans }).node))).toEqual([
      "'ABeeZee' 400 normal",
    ]);
  });
});
