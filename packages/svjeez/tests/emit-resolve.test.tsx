import { expect, test } from "bun:test";
import { Shape, rect, scene, tokens } from "svjeez";
import { svg } from "svjeez/tools";
import { restyle } from "svjeez/page";

const page = tokens({
  light: { ink: "#111111", bg: "#ffffff" },
  dark: { ink: "#eeeeee", bg: "#000000" },
});

const card = scene({ size: [40, 40], duration: 1, title: "Card", theme: page }, () => (
  <Shape geometry={rect(40, 40)} fill={page.ink} stroke={{ color: page.bg, width: 2 }} />
));

test("a resolved token is one CSS value, not light and dark ones", () => {
  const out = svg.emit(card, { resolve: { ink: "currentColor", bg: "inherit" } });

  expect(out).toContain("--ink:currentColor");
  expect(out).toContain("--bg:inherit");
  expect(out).not.toContain("#111111");
  expect(out).not.toContain("#eeeeee");
  expect(out).toContain("var(--ink)");
});

test("a token left unresolved keeps its light and dark values", () => {
  const out = svg.emit(card, { resolve: { ink: "currentColor" } });

  expect(out).toContain("--bg:#000000");
  expect(out).toContain("--bg:#FFFFFF");
});

test("resolving a token the scene does not have is an error that names its tokens", () => {
  expect(() => svg.emit(card, { resolve: { nope: "red" } })).toThrow('"nope"');
  expect(() => svg.emit(card, { resolve: { nope: "red" } })).toThrow('"ink", "bg"');
});

test("restyle pins prefers-color-scheme to a scheme, including the theme it adds", () => {
  const dark = restyle(svg.emit(card), { scheme: "dark", theme: page });

  expect(dark).not.toMatch(/prefers-color-scheme/);
  expect(dark).toContain("@media (max-width: -1px)");
  expect(restyle(svg.emit(card), { scheme: "light" })).toContain("@media (min-width: 0)");
});
