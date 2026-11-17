/** @jsxImportSource svjeez */
import { describe, expect, test } from "bun:test";
import { adaptive, render, systemDark, systemLight, type SvgNode } from "svjeez";
import {
  Dom,
  type Box,
  type Item,
  type Paint,
  type Rgb,
  type Snapshot,
  type TextRun,
} from "../src/index.ts";
import { paletteCss, roles } from "../src/palette.ts";

const palette = { light: systemLight, dark: systemDark };

// The palette's colors as Chromium reads them back: rgb() in each scheme.
const rgb = (hex: string, alpha = 1): Rgb => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

  return alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`;
};

const slot = (name: keyof typeof systemLight, alpha = 1): Paint => ({
  light: rgb(systemLight[name], alpha),
  dark: rgb(systemDark[name], alpha),
});

const run = (text: string, color: Paint): TextRun => ({
  kind: "text",
  text,
  x: 20,
  y: 40,
  size: 16,
  weight: 400,
  family: "sans-serif",
  style: "normal",
  color,
  letterSpacing: 0,
  advances: [...text].map((_, i) => (i + 1) * 9),
});

const card = (background: Paint, children: Item[] = []): Snapshot => {
  const root: Box = {
    kind: "box",
    tag: "div",
    box: { x: 0, y: 0, width: 200, height: 100 },
    radii: [8, 8, 8, 8],
    background,
    border: { widths: [1, 1, 1, 1], color: slot("base02") },
    shadows: [{ color: slot("base05", 0.2), x: 0, y: 4, blur: 0, spread: 0 }],
    opacity: 1,
    clip: false,
    children,
  };

  return { width: 200, height: 100, pad: 0, box: root.box, root };
};

const svg = (node: SvgNode) =>
  render(
    { width: 200, height: 100, duration: 2, title: "palette", css: adaptive(palette).css },
    node,
  );

describe("<Dom palette>", () => {
  test("a recorded color that is a palette slot in both schemes draws as its variable", () => {
    const out = svg(
      <Dom states={card(slot("base01"), [run("Hi", slot("base05"))])} palette={palette} />,
    );

    expect(out).toContain('fill="var(--base01)"');
    expect(out).toContain('fill="var(--base05)"');
    expect(out).toContain("var(--base02)");
    expect(out).not.toMatch(/--dom-[a-z0-9]+:/);
  });

  test("a see-through slot draws as the slot at its alpha", () => {
    const out = svg(<Dom states={card(slot("base0D", 0.15))} palette={palette} />);

    expect(out).toContain("--dom-base0D-15:color-mix(in srgb,var(--base0D) 15%,transparent)");
    expect(out).toContain("--dom-base05-20:color-mix(in srgb,var(--base05) 20%,transparent)");
  });

  test("a tween between two slots animates between their variables", () => {
    const out = svg(
      <Dom
        states={[card(slot("base01")), [card(slot("base0D")), { over: 1 }]]}
        palette={palette}
      />,
    );

    const frames = out.match(/@keyframes[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/g) ?? [];

    expect(frames.some((k) => k.includes("var(--base01)") && k.includes("var(--base0D)"))).toBe(
      true,
    );
    expect(out).not.toContain("<animate");
  });

  test("colors outside the palette stay as recorded", () => {
    const out = svg(
      <Dom
        states={card({ light: "rgb(12,34,56)", dark: "rgb(65,43,21)" }, [
          run("Hi", "rgb(200,10,10)"),
        ])}
        palette={palette}
      />,
    );

    expect(out).toContain('fill="rgb(200,10,10)"');
    expect(out).toMatch(/--dom-[a-z0-9]+:rgb\(12,34,56\)/);
  });

  test("without a palette nothing changes", () => {
    const out = svg(<Dom states={card(slot("base01"))} />);

    expect(out).not.toContain("var(--base01)");
  });
});

describe("roles", () => {
  const role = roles(palette);

  test("needs both schemes to agree, so slots one scheme shares stay apart", () => {
    // systemLight's base05 and base06 are one color; dark tells them apart.
    expect(role(slot("base06"))?.slot).toBe("base06");
    expect(role(slot("base05"))?.slot).toBe("base05");
    expect(role({ light: rgb(systemLight.base05), dark: rgb(systemDark.base0D) })).toBe(undefined);
  });

  test("forgives a faint color's rounding, in proportion to how faint it is", () => {
    const [r, g, b] = [0x0a + 3, 0x6c - 2, 0xff];
    const [dr, dg, db] = [0x5e, 0xa0 + 3, 0xff];

    expect(
      role({ light: `rgba(${r},${g},${b},0.15)`, dark: `rgba(${dr},${dg},${db},0.15)` }),
    ).toEqual({ slot: "base0D", alpha: 0.15 });
    expect(role({ light: `rgb(${r},${g},${b})`, dark: `rgb(${dr},${dg},${db})` })).toBe(undefined);
  });

  test("paletteCss defines the slots on the page, dark under the media query", () => {
    expect(paletteCss(palette)).toStartWith(`:root{--base00:${systemLight.base00};`);
    expect(paletteCss(palette)).toContain(
      `@media (prefers-color-scheme:dark){:root{--base00:${systemDark.base00};`,
    );
  });
});
