import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { render } from "svjeez";

import build, { fileKb, fileLine, propsOf, states } from "../explainer/index.tsx";
import scene, { frame } from "../explainer/scene.tsx";
import { blip } from "../site/lib/blip";

describe("the explainer's code is what plays", () => {
  const squash = (text: string) => text.replace(/\s+/g, "");
  const styleOf = (svg: string) => squash(svg.match(/<style>[\s\S]*<\/style>/)![0]);

  const keyframes = (css: string) =>
    css.match(/@keyframesk\d+\{.*?\}\}/g)!.map((k) => k.replace(/^@keyframesk\d+/, ""));

  test("the start is scene.tsx", () => {
    const file = readFileSync(new URL("../explainer/scene.tsx", import.meta.url), "utf8").replace(
      "export const hop",
      "const hop",
    );

    const lines = states[0]!.lines;

    expect(file).toContain(lines.slice(0, 3).join("\n"));
    expect(file).toContain(
      lines
        .slice(4)
        .map((l) => (l ? `  ${l}` : l))
        .join("\n")
        .replace("  render(", "export default () =>\n  render("),
    );
  });

  test("each edit changes one line", () => {
    states.slice(1).forEach(({ lines, changed }, i) => {
      const before = states[i]!.lines;
      const same = lines.filter((line, k) => line === before[k] || line === before[k - 1]);

      expect(lines[changed]).not.toBe(before[changed]);
      expect(lines.length - same.length).toBe(1);
    });
  });

  test("each state compiles, and its keyframes are in the explainer", () => {
    const played = styleOf(build());

    for (const state of states) {
      const own = styleOf(render(frame, blip(propsOf(state))));

      expect(keyframes(own).length).toBeGreaterThan(0);

      for (const frames of keyframes(own)) expect(played).toContain(frames);
    }

    expect(played).toContain("cubic-bezier(.34,1.56,.64,1)");

    const motions = states.map((s) => styleOf(render(frame, blip(propsOf(s)))));

    expect(new Set(motions).size).toBe(states.length);
  });

  test("the start plays what scene.tsx writes", () => {
    expect(render(frame, blip(propsOf(states[0]!)))).toBe(scene());
  });

  test("the file line is the real size and says no JavaScript", () => {
    const svg = scene();

    expect(svg).not.toContain("<script");
    expect(fileKb).toBe((new TextEncoder().encode(svg).length / 1024).toFixed(1));
    expect(fileLine).toBe(`scene.svg · ${fileKb} KB · 0 lines of JS`);
  });

  test("the explainer itself builds with no script", () => {
    expect(build()).not.toContain("<script");
  });
});
