import { describe, expect, test } from "bun:test";
import { defsTree } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("defs", () => {
  test("ids are deterministic across renders", () => {
    expect(scene(defsTree())).toBe(scene(defsTree()));
  });
});
