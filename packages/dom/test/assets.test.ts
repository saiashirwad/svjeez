import { describe, expect, test } from "bun:test";
import { inlineAssets, type ElementNode } from "../src/index.ts";
import { box, snapshot } from "./fixtures.ts";

const image = (src: string) =>
  box({
    tag: "img",
    image: { src, width: 1, height: 1, objectFit: "fill", objectPosition: "50% 50%" },
  });

const word = (family: string) => ({
  type: "text" as const,
  runs: [
    {
      x: 0,
      y: 0,
      text: "a",
      advances: [8],
      font: {
        family: `"${family}", sans-serif`,
        weight: 400,
        italic: false,
        stretch: 100,
        size: 16,
      },
      letterSpacing: 0,
      color: "rgb(0, 0, 0)",
    },
  ],
});

const elements = (node: ElementNode): ElementNode[] =>
  node.children.filter((child): child is ElementNode => child.type === "element");

const fake = () => {
  const asked: string[] = [];

  const fetch = async (url: string) => {
    asked.push(url);

    return url.includes("missing")
      ? new Response("no", { status: 404 })
      : new Response(new Uint8Array([1, 2, 3]), {
          headers: url.endsWith(".png") ? { "content-type": "image/png" } : {},
        });
  };

  return { asked, fetch };
};

describe("inlineAssets", () => {
  test("embeds images and backgrounds once each, across snapshots", async () => {
    const { asked, fetch } = fake();

    const one = snapshot(
      box({
        backgrounds: [{ kind: "image", src: "http://x/bg.png" }],
        children: [image("http://x/a.png"), image("data:image/png;base64,AAAA")],
      }),
    );

    const two = snapshot(box({ children: [image("http://x/a.png")] }));
    const [a, b] = await inlineAssets([one, two], { fetch });

    expect(asked.sort()).toEqual(["http://x/a.png", "http://x/bg.png"]);

    const kids = elements(a!.root);

    expect(kids[0]!.image!.src).toBe("data:image/png;base64,AQID");
    expect(kids[1]!.image!.src).toBe("data:image/png;base64,AAAA");
    expect(a!.root.backgrounds![0]).toEqual({ kind: "image", src: "data:image/png;base64,AQID" });
    expect(elements(b!.root)[0]!.image!.src).toStartWith("data:");
  });

  test("embeds only the web fonts the text uses", async () => {
    const { asked, fetch } = fake();

    const [out] = await inlineAssets(
      [
        snapshot(box({ children: [word("Mono")] }), {
          fonts: [
            { family: "Mono", weight: 400, italic: false, src: "http://x/mono.woff2" },
            { family: "Unused", weight: 400, italic: false, src: "http://x/unused.woff2" },
          ],
        }),
      ],
      { fetch },
    );

    expect(asked).toEqual(["http://x/mono.woff2"]);
    expect(out!.fonts).toEqual([
      { family: "Mono", weight: 400, italic: false, src: "data:font/woff2;base64,AQID" },
    ]);
  });

  test("a URL that cannot be fetched throws and names it", async () => {
    const { fetch } = fake();

    expect(inlineAssets([snapshot(image("http://x/missing.png"))], { fetch })).rejects.toThrow(
      /http:\/\/x\/missing\.png: 404/,
    );
  });
});
