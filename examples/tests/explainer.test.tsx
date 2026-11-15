import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";

import build, { fileKb, fileLine, shownCss, source } from "../explainer/index.tsx";
import scene from "../explainer/scene.tsx";

// The explainer shows scene.tsx and the CSS it compiles to. If either changes, update examples/explainer/index.tsx.
describe("the explainer's code is what svjeez outputs", () => {
  const svg = scene();
  const squash = (text: string) => text.replace(/\s+/g, "");

  test("the snippet is scene.tsx, as a user would import the chick", () => {
    const file = readFileSync(new URL("../explainer/scene.tsx", import.meta.url), "utf8")
      .replace('"../site/lib/chick"', '"./chick"')
      .replace("export const hop", "const hop")
      .trim();

    expect(source).toBe(file);
  });

  test("every rule it shows is in the CSS render() writes", () => {
    const style = squash(svg.match(/<style>[\s\S]*<\/style>/)![0]);

    // Each line is a selector, a declaration or a brace, so each must appear on its own.
    for (const line of shownCss.split("\n")) {
      const bare = squash(line).replace(/;\}/, "}").replace(/[{;]$/, "").replace(/^\}$/, "");

      if (bare) expect(style).toContain(bare);
    }

    expect(style).toContain("0%,20%,60%,100%{translate:0px60px}");
    expect(style).toContain("40%{translate:0px0px;");
    expect(style).toContain(".m1{animation-name:k1}");
  });

  test("the file line is the real size and says no JavaScript", () => {
    expect(svg).not.toContain("<script");
    expect(fileKb).toBe((new TextEncoder().encode(svg).length / 1024).toFixed(1));
    expect(fileLine).toBe(`scene.svg · ${fileKb} KB · 0 lines of JS`);
  });

  test("the explainer itself builds with no script", () => {
    expect(build()).not.toContain("<script");
  });
});
