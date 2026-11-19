import { describe, expect, test } from "bun:test";
import { toPortable } from "../src/portable.ts";
import { scriptInputs } from "../src/film.ts";
import type { State } from "../src/record.ts";

const state = (html: string) => [{ html }] as unknown as State[];
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
    const a = scriptInputs(async () => { await 1; }, undefined);
    const b = scriptInputs(async () => {   await 1;   }, undefined);
    const c = scriptInputs(async () => { await 1; await 2; }, undefined);

    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
