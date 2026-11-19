import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { film } from "../src/index.ts";
import { component as viteComponent, runFilm } from "../src/vite.ts";
import { component } from "../src/bun.ts";
import { serializeProps, type Prop } from "../src/props.ts";
import Card, { Named } from "./component/Card.tsx";

const dir = join(import.meta.dir, "component");

describe("component through Vite", () => {
  test("films a React component, loads css, and update() merges props", async () => {
    const scene = await runFilm(join(dir, "react.film.ts"));

    expect(scene.duration).toBeGreaterThan(0);
  }, 90_000);

  test("films a Svelte component", async () => {
    const scene = await runFilm(join(dir, "svelte.film.ts"));

    expect(scene.duration).toBeGreaterThan(0);
  }, 90_000);

  test("a component defined in the film file is refused", async () => {
    await expect(runFilm(join(dir, "local.film.ts"))).rejects.toThrow(
      "defined in the film file itself",
    );
  }, 60_000);

  test("a component nothing exports is not found", async () => {
    await expect(runFilm(join(dir, "orphan.film.ts"))).rejects.toThrow(
      "could not find the module that exports Orphan",
    );
  }, 60_000);

  test("a Date prop is refused with the prop's path", async () => {
    await expect(runFilm(join(dir, "json.film.ts"))).rejects.toThrow("props.label is a Date");
  }, 60_000);

  test("update() refuses a Map", async () => {
    await expect(runFilm(join(dir, "plain.film.ts"))).rejects.toThrow(
      "update: props.label is a Map",
    );
  }, 60_000);

  test("component() outside runFilm says how to run the film file", async () => {
    await expect(viteComponent(Card, { task: { id: 1, title: "t", done: false } })).rejects.toThrow(
      "runFilm(file)",
    );
  });
});

describe("component through Bun", () => {
  test("finds the module by export identity, loads css, and update() merges props", async () => {
    const scene = (await import("./component/bun.film.tsx")).default;

    expect(scene.duration).toBeGreaterThan(0);
  }, 60_000);

  test("a named export is found too", async () => {
    const target = await component(Named, { label: "hi" });

    try {
      const scene = await film(target, async ({ snap }) => void (await snap("a")), {
        onDiagnostics: () => {},
      });

      expect(scene.size[0]).toBeGreaterThan(0);
    } finally {
      await target.close();
    }
  }, 60_000);

  test("a component defined here is refused", async () => {
    const Local = () => null;

    await expect(component(Local, {})).rejects.toThrow("could not find the module");
  });
});

class Point {
  x = 1;
}

// These are the values the runtime check exists for; the types would refuse them.
const loose = (value: any): Prop => value;

describe("serializeProps", () => {
  test("splits functions from data and drops undefined", () => {
    expect(serializeProps({ a: 1, b: () => {}, c: undefined, d: { e: [null, "x"] } }, "t")).toEqual(
      {
        data: { a: 1, d: { e: [null, "x"] } },
        fns: ["b"],
      },
    );
  });

  test("names what JSON cannot carry, and where", () => {
    expect(() => serializeProps({ when: loose(new Date()) }, "t")).toThrow(
      "t: props.when is a Date",
    );
    expect(() => serializeProps({ a: { m: loose(new Map()) } }, "t")).toThrow("props.a.m is a Map");
    expect(() => serializeProps({ a: [1, loose(new Set())] }, "t")).toThrow("props.a[1] is a Set");
    expect(() => serializeProps({ n: Number.NaN }, "t")).toThrow("props.n is NaN");
    expect(() => serializeProps({ a: { f: () => {} } }, "t")).toThrow("props.a.f is a function");
    expect(() => serializeProps({ s: Symbol("x") }, "t")).toThrow("props.s is a Symbol");

    expect(() => serializeProps({ p: loose(new Point()) }, "t")).toThrow("props.p is a Point");

    const loop: Record<string, Prop> = {};

    loop.self = loop;

    expect(() => serializeProps({ loop }, "t")).toThrow("refers back to itself");
  });
});
