import { afterAll, describe, expect, test } from "bun:test";
import { mix, scene, tokens } from "svjeez";
import { restyle } from "svjeez/page";
import { svg } from "svjeez/tools";
import { fromTheme } from "../src/compile/theme.ts";
import { compile, film, mergeSchemes, themeCss, type Target } from "../src/index.ts";
import { box, snapshot } from "./fixtures.ts";

const theme = tokens({
  light: { background: "#FFFFFF", text: "#1D1D1F", blue: "#0A6CFF" },
  dark: { background: "#090A0C", text: "#E5E5EA", blue: "#5EA0FF" },
});

describe("fromTheme", () => {
  test("reads a pair back as the token that makes it", () => {
    expect(fromTheme("#ffffff", "#090a0c", theme)).toBe(theme.background);
    expect(fromTheme("#0a6cff", "#5ea0ff", theme)?.name).toBe("blue");
  });

  test("a color-mix() of two tokens is their mix() at a whole percent", () => {
    // color-mix(in srgb, var(--blue) 12%, var(--background)), as Chromium paints it in each scheme.
    const made = mix(theme.blue, theme.background, 0.12);
    const token = fromTheme(made.light, made.dark, theme);

    expect(token?.mix).toBeDefined();
    expect(token?.light).toBe(made.light);
    expect(token?.dark).toBe(made.dark);
  });

  test("a token at an alpha is a mix with transparent", () => {
    const token = fromTheme("#0a6cff24", "#5ea0ff24", theme);

    expect(token?.mix?.a).toBe(theme.blue);
    expect(token?.mix?.b).toBe("#00000000");
    expect(token?.light).toBe("#0a6cff24");
  });

  test("a color the theme does not make is left alone", () => {
    expect(fromTheme("#ff0000", "#00ff00", theme)).toBeUndefined();
    // The same alpha in both schemes, or nothing.
    expect(fromTheme("#0a6cff24", "#5ea0ff80", theme)).toBeUndefined();
  });
});

const paint = (bg: string) => snapshot(box({ background: bg }));

describe("compile with a theme", () => {
  test("paints with the theme's tokens, which restyle() recolors", () => {
    const compiled = compile(
      [{ name: "", snapshot: mergeSchemes(paint("rgb(255, 255, 255)"), paint("rgb(9, 10, 12)")) }],
      { theme },
    );

    const out = svg.emit(
      scene({ size: compiled.size, duration: 1, title: "t" }, () => compiled.element),
    );

    expect(out).toContain("--background:#");
    expect(out).toContain("var(--background)");
    expect(out).not.toContain("--c-");

    const other = restyle(out, {
      theme: tokens({ light: { background: "#FDF6E3" }, dark: { background: "#002B36" } }),
    });

    expect(other).toContain("--background:#002B36");
  });

  test("without a theme the pair stays its own token", () => {
    const compiled = compile(mergeSchemes(paint("rgb(255, 255, 255)"), paint("rgb(9, 10, 12)")));

    const out = svg.emit(
      scene({ size: compiled.size, duration: 1, title: "t" }, () => compiled.element),
    );

    expect(out).toContain("--c-ffffff-090a0c:");
  });
});

const html = `<!doctype html>
<style>
  html, body { margin: 0 }
  #app { width: 200px; height: 100px; background: var(--background); color: var(--text) }
  #chip { width: 50px; height: 20px; background: color-mix(in srgb, var(--blue) 12%, var(--background)) }
  #tint { width: 50px; height: 20px; background: color-mix(in srgb, var(--blue) 14%, transparent) }
</style>
<div id="app"><div id="chip"></div><div id="tint"></div></div>`;

const server = Bun.serve({
  port: 0,
  fetch: () => new Response(html, { headers: { "content-type": "text/html" } }),
});

afterAll(() => server.stop(true));

const target = (): Target => ({
  url: `http://localhost:${server.port}/`,
  selector: "#app",
  sources: async () => "theme",
  close: async () => {},
});

describe("film with a theme", () => {
  test("gives the page the tokens and draws its colors with them", async () => {
    const out = svg.emit(
      await film(
        target(),
        async ({ snap }) => {
          await snap("one");
        },
        {
          theme,
          viewport: { width: 240, height: 140 },
          onDiagnostics: () => {},
        },
      ),
    );

    expect(out).toContain("--background:#FFFFFF");
    expect(out).toContain("var(--background)");
    expect(out).toMatch(/--[\w-]*blue[\w-]*:color-mix\(in srgb,var\(--(blue|background)\) \d+%/);
    expect(out).toContain("color-mix(in srgb,var(--blue) 14%,");
    expect(out).not.toContain("--c-");
  }, 60_000);

  test("a theme is filmed in both schemes", async () => {
    expect(film(target(), async () => {}, { theme, scheme: "light" })).rejects.toThrow(
      /both schemes/,
    );
  });

  test("themeCss declares the tokens in each scheme", () => {
    expect(themeCss(theme)).toBe(
      ":root{--background:#FFFFFF;--text:#1D1D1F;--blue:#0A6CFF}@media (prefers-color-scheme:dark){:root{--background:#090A0C;--text:#E5E5EA;--blue:#5EA0FF}}",
    );
  });
});
