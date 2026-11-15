import { readFileSync } from "node:fs";
import { describe, expect, test } from "bun:test";
import { render } from "svjeez";

import build, { fileKb, fileLine, hopOf, states } from "../explainer/index.tsx";
import scene, { frame } from "../explainer/scene.tsx";
import { chick } from "../site/lib/chick";

// The explainer shows scene.tsx's hop, edited three times. Each state's lines are run to make the chick that plays.
describe("the explainer's code is what plays", () => {
  const squash = (text: string) => text.replace(/\s+/g, "");
  const styleOf = (svg: string) => squash(svg.match(/<style>[\s\S]*<\/style>/)![0]);
  const keyframes = (css: string) => css.match(/@keyframesk\d+\{.*?\}\}/g)!.map((k) => k.replace(/^@keyframesk\d+/, ""));

  test("the start is scene.tsx", () => {
    const file = readFileSync(new URL("../explainer/scene.tsx", import.meta.url), "utf8").replace("export const hop", "const hop");
    const [hop, render] = [states[0]!.lines.slice(0, 3), states[0]!.lines[4]!];

    expect(file).toContain(hop.join("\n"));
    expect(file).toContain(render.replace("render(frame, ", "export default () => render(frame, "));
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
      const own = styleOf(render(frame, chick({ body: hopOf(state) })));

      expect(keyframes(own).length).toBeGreaterThan(0);
      for (const frames of keyframes(own)) expect(played).toContain(frames);
    }

    expect(played).toContain("cubic-bezier(.34,1.56,.64,1)");

    // Every edit changes what plays.
    const motions = states.map((s) => styleOf(render(frame, chick({ body: hopOf(s) }))));

    expect(new Set(motions).size).toBe(states.length);
  });

  test("the start plays what scene.tsx writes", () => {
    expect(render(frame, chick({ body: hopOf(states[0]!) }))).toBe(scene());
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
