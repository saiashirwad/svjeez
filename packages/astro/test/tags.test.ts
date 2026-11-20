import { expect, test } from "bun:test";
import { ogTags } from "../src/tags.ts";

const image = {
  src: "/_svjeez/a.jpg",
  width: 1200,
  height: 630,
  type: "image/jpeg",
  title: "T",
  desc: 'A "card" <1>',
};

test("a card's tags point at an absolute URL, with its size, secure_url and escaped alts", () => {
  const tags = ogTags(image, new URL("https://example.com/"));

  expect(tags).toContain('property="og:image" content="https://example.com/_svjeez/a.jpg"');
  expect(tags).toContain(
    'property="og:image:secure_url" content="https://example.com/_svjeez/a.jpg"',
  );
  expect(tags).toContain('property="og:image:width" content="1200"');
  expect(tags).toContain('property="og:image:alt" content="A &quot;card&quot; &lt;1>"');
  expect(tags).toContain('name="twitter:image" content="https://example.com/_svjeez/a.jpg"');
  expect(tags).toContain('name="twitter:image:alt" content="A &quot;card&quot; &lt;1>"');
});

test("http sites omit og:image:secure_url", () => {
  expect(ogTags(image, new URL("http://localhost:4321/"))).not.toContain("og:image:secure_url");
});

test("a card with no description has no alt tags", () => {
  const tags = ogTags({ ...image, desc: "" }, new URL("https://example.com/"));

  expect(tags).not.toContain("og:image:alt");
  expect(tags).not.toContain("twitter:image:alt");
});
