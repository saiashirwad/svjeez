import { describe, expect, test } from "bun:test";
import { scene } from "../helpers/prefix-scene";

describe("prefix", () => {
  test("a prefix must be a CSS identifier start", () => {
    for (const bad of ["1a", "-a", "a b", "a.b", 'a"b'])
      expect(() => scene(bad)).toThrow(/needs a prefix/);
  });
});
