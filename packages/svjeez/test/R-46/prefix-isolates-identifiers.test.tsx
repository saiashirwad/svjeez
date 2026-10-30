import { describe, expect, test } from "bun:test";
import { names, scene } from "../helpers/prefix-scene";

describe("prefix", () => {
  test("an empty prefix changes nothing", () => {
    expect(scene("")).toBe(scene());
  });

  test("two scenes with different prefixes share no generated identifier", () => {
    const [a, b] = [scene("one-"), scene("two-")];
    expect([...names(a)].filter((name) => names(b).has(name))).toEqual([]);
    expect(a).toContain('id="one-t"');
    expect(a).toContain('aria-labelledby="one-t one-d"');
    expect(a).toContain("@keyframes one-k1");
    expect(a).toMatch(/\.one-m1\{/);
    expect(a).toMatch(/\.one-a\{/);
    expect(a).toMatch(/\.one-fb\{/);
    expect(a).toContain("url(#one-");
  });

  test("two scenes without prefixes share identifiers", () => {
    const shared = [...names(scene())].filter((name) => names(scene()).has(name));
    expect(shared).toContain("t");
    expect(shared).toContain("k1");
  });
});
