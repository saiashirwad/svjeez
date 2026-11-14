import { describe, expect, test } from "bun:test";
import { el, motion, render } from "svjeez";
import { Fragment, jsxDEV } from "svjeez/jsx-dev-runtime";

const options = { width: 100, height: 60, duration: 2, title: "Sources" };

// What a development JSX transform writes for this file, called by hand so the positions are known.
const scene = () =>
  jsxDEV(Fragment, {
    children: [
      jsxDEV("rect", { width: 100, height: 60 }, undefined, false, {
        fileName: "scene.tsx",
        lineNumber: 3,
        columnNumber: 5,
      }),
      jsxDEV(
        "g",
        {
          animation: motion({ y: 10 }).to({ y: 0 }, 1),
          children: jsxDEV("circle", { r: 4 }, undefined, false, { fileName: "", lineNumber: 5 }),
        },
        undefined,
        false,
        { fileName: "scene.tsx", lineNumber: 4, columnNumber: 5 },
      ),
    ],
  });

describe("render sources", () => {
  test("tags each element with where it was written", () => {
    const svg = render({ ...options, sources: true }, scene());

    expect(svg).toContain('<rect width="100" height="60" data-source="scene.tsx:3:5"/>');
    expect(svg).toContain('data-source="scene.tsx:4:5"');
    expect(svg).toContain('<circle r="4" data-source="5"/>');
  });

  test("a component's root takes the place the component was used, unless it has one of its own", () => {
    const Dot = () => el.circle({ r: 3 });

    const svg = render(
      { ...options, sources: true },
      jsxDEV(Dot, {}, undefined, false, { lineNumber: 9, columnNumber: 2 }),
    );

    expect(svg).toContain('<circle r="3" data-source="9:2"/>');

    const Ring = () => jsxDEV("circle", { r: 5 }, undefined, false, { lineNumber: 20 });

    expect(
      render(
        { ...options, sources: true },
        jsxDEV(Ring, {}, undefined, false, { lineNumber: 9, columnNumber: 2 }),
      ),
    ).toContain('<circle r="5" data-source="20"/>');
  });

  test("changes nothing else, and nothing by default", () => {
    const plain = render(options, scene());

    expect(plain).not.toContain("data-source");
    expect(
      render({ ...options, sources: true }, scene()).replace(/ data-source="[^"]*"/g, ""),
    ).toBe(plain);
  });
});
