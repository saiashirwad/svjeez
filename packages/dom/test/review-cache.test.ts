import { describe, expect, test } from "bun:test";
import { toPortable } from "../src/portable.ts";
import { scriptInputs } from "../src/film.ts";
import type { State } from "../src/record.ts";

// SAFETY: the portable pass only stringifies and rewrites the states, so a stand-in object with one string field is enough.
const state = (html: string): State[] => JSON.parse(JSON.stringify([{ html }]));
const origin = "http://localhost:1234";

describe("toPortable with a short base", () => {
  test("allows /app-icon.png URLs and prose mentioning the base", () => {
    const html = `<img src="${origin}/app-icon.png"><p>Open /app settings</p><a href="/app-x">`;

    expect(() => toPortable(state(html), origin, "/app")).not.toThrow();
  });

  test("still throws on a real absolute path", () => {
    expect(() => toPortable(state(`<img src="/app/logo.png">`), origin, "/app")).toThrow(/leaks/);
    expect(() => toPortable(state(`url(file:///app/logo.png)`), origin, "/app")).toThrow(/leaks/);
  });

  test("rewrites /@fs URLs under the base", () => {
    const out = toPortable(state(`<img src="${origin}/@fs/app/a.png">`), origin, "/app");

    expect(JSON.stringify(out)).toContain("/@base/a.png");
  });
});

describe("scriptInputs", () => {
  test("changes with the script, not its whitespace", () => {
    const a = scriptInputs(new Function("return 1;"), undefined);
    const b = scriptInputs(new Function("return   1;"), undefined);
    const c = scriptInputs(new Function("return 1; return 2;"), undefined);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
