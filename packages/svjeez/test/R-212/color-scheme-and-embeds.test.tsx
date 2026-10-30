import { describe, expect, test } from "bun:test";
import { Picture, picture, render, type SvgNode } from "svjeez";
import { renderFrames } from "svjeez/frames";
import { systemColorScheme } from "../../src/scheme";
import { browser } from "../helpers/frames-browser";
import { same, solidPng } from "../helpers/frames";

describe.if(browser)("renderFrames", () => {
  test("frames follow the system color scheme unless told otherwise", async () => {
    const svg = render(
      {
        width: 20,
        height: 20,
        duration: 1,
        title: "Scheme",
        css: "rect{fill:#ffffff}@media (prefers-color-scheme:dark){rect{fill:#000000}}",
      },
      <rect width={20} height={20} />,
    );

    const [light, dark, system, fallback] = await Promise.all([
      renderFrames(svg, { times: [0], colorScheme: "light" }),
      renderFrames(svg, { times: [0], colorScheme: "dark" }),
      renderFrames(svg, { times: [0], colorScheme: "system" }),
      renderFrames(svg, { times: [0] }),
    ]);

    expect(same(light.frames[0]!.png, dark.frames[0]!.png)).toBe(false);
    expect(fallback.colorScheme).toBe(systemColorScheme());
    expect(system.colorScheme).toBe(systemColorScheme());
    expect(
      same(fallback.frames[0]!.png, (systemColorScheme() === "dark" ? dark : light).frames[0]!.png),
    ).toBe(true);
  });

  test("an embedded raster and an embedded SVG paint their own colors", async () => {
    const scene = (child: SvgNode) =>
      render({ width: 20, height: 20, duration: 1, title: "Embed" }, child);

    const raster = picture(solidPng(8, 8, [0, 200, 0]));

    const vector = picture(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="#c80000"/></svg>',
    );

    const paint = async (child: SvgNode) =>
      (await renderFrames(scene(child), { times: [0], colorScheme: "light" })).frames[0]!.png;

    const png = await paint(<Picture src={raster} x={0} y={0} width={20} height={20} />);
    const svg = await paint(<Picture src={vector} x={0} y={0} width={20} height={20} />);
    const green = await paint(<rect width={20} height={20} fill="#00c800" />);
    const red = await paint(<rect width={20} height={20} fill="#c80000" />);
    expect(same(png, green)).toBe(true);
    expect(same(svg, red)).toBe(true);
    expect(same(png, svg)).toBe(false);
  });
});
