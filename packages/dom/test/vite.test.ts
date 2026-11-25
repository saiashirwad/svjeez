import { describe, expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm } from "node:fs/promises";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { svg } from "svjeez/tools";
import { film } from "../src/index.ts";
import { titleFromFile } from "../src/film.ts";
import { serve } from "../src/vite.ts";

const root = join(import.meta.dir, "app");

test("serve hashes the project's modules and films the page", async () => {
  const server = await serve({ root, selector: "#app" });

  try {
    expect(await server.sources()).toBe(await server.sources());
    expect(server.url).toMatch(/^http:\/\/localhost:\d+\/$/);
  } finally {
    await server.close();
  }

  const board = await film(
    serve({ root, selector: "#app" }),
    async ({ page, snap }) => {
      await snap("start");
      await page.click("#add");
      await snap("added");
    },
    { onDiagnostics: () => {} },
  );

  expect(board.duration).toBeGreaterThan(0);
});

test("title defaults to the page <title>, then the film file's name; the option wins", async () => {
  const titleOf = async (
    options: { title?: string },
    target = serve({ root, selector: "#app" }),
  ) => {
    const scene = await film(target, async ({ snap }) => void (await snap("a")), {
      ...options,
      onDiagnostics: () => {},
    });

    return /<title[^>]*>([^<]*)<\/title>/.exec(svg.emit(scene))?.[1];
  };

  expect(await titleOf({})).toBe("Svjeez test app");
  expect(await titleOf({ title: "Mine" })).toBe("Mine");
});

test("titleFromFile names the film file, or the folder of an index", () => {
  expect(titleFromFile("/a/board.film.tsx")).toBe("board");
  expect(titleFromFile("/a/sprint/index.tsx")).toBe("sprint");
  expect(titleFromFile(undefined)).toBe("Untitled");
});

describe("assets outside the Vite root", () => {
  const outside = join(import.meta.dir, "outside");

  test("a <link> to a file outside the root is served, not answered with HTML", async () => {
    let brand = "";

    await film(
      serve({ root: join(outside, "app"), selector: "#app" }),
      async ({ page, snap }) => {
        brand = await page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue("--brand").trim(),
        );
        await snap("a");
      },
      { onDiagnostics: () => {} },
    );

    expect(brand).toBe("#123456");
  }, 60_000);

  test("a stylesheet the server answers with HTML fails loudly, naming the URL", async () => {
    await expect(
      film(
        serve({ root: join(outside, "missing"), selector: "#app" }),
        async ({ snap }) => void (await snap("a")),
        {
          onDiagnostics: () => {},
        },
      ),
    ).rejects.toThrow(/stylesheet http:\/\/localhost:\d+\/nope\.css\?v=1 came back as text\/html/);
  }, 60_000);
});

describe("cached states are portable", () => {
  const outside = join(import.meta.dir, "outside");

  test("a cached file holds no absolute path, and still films with the font inlined", async () => {
    const dir = await mkdtemp(join(tmpdir(), "svjeez-dom-portable-"));
    const cache = join(dir, "states.json");

    try {
      const make = () =>
        film(
          serve({ root: join(outside, "font"), selector: "#app" }),
          async ({ snap }) => {
            await snap("a");
          },
          { cache, onDiagnostics: () => {} },
        );

      const first = svg.emit(await make());
      const stored = await readFile(cache, "utf8");

      expect(stored).toContain("svjeez-dom.invalid/@base/");
      expect(stored).not.toContain(homedir());
      expect(stored).not.toContain(join(import.meta.dir, ".."));
      expect(stored).not.toContain("/@fs");
      expect(stored).not.toContain("localhost");
      expect(first).toContain("data:font/ttf;base64,");
      expect(svg.emit(await make())).toBe(first);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("sources() does not depend on where the project is checked out", async () => {
    const copy = await mkdtemp(join(tmpdir(), "svjeez-dom-moved-"));

    try {
      await cp(outside, join(copy, "outside"), { recursive: true });

      const hash = async (root: string) => {
        const server = await serve({ root, selector: "#app" });

        try {
          return await server.sources();
        } finally {
          await server.close();
        }
      };

      expect(await hash(join(copy, "outside", "app"))).toBe(await hash(join(outside, "app")));
    } finally {
      await rm(copy, { recursive: true, force: true });
    }
  }, 60_000);
});
