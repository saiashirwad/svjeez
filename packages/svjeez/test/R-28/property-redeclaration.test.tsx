import { describe, expect, test } from "bun:test";
import { def } from "svjeez";
import { yaw } from "../helpers/compile-fixtures";

describe("properties", () => {
  test("declaring a property again returns the same key, and declaring it differently throws", () => {
    expect(def.property("yaw", { syntax: "angle", inherits: true, initial: 0 })).toBe(yaw);
    expect(() => def.property("yaw", { syntax: "angle", inherits: false, initial: 0 })).toThrow(
      /already declared/,
    );
  });
});
