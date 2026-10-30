import { describe, expect, test } from "bun:test";
import { def, motion } from "svjeez";
import { yaw } from "../helpers/compile-fixtures";
import { scene } from "../helpers/compile-scene";

describe("properties", () => {
  test("a filter primitive cannot animate a property", () => {
    // SAFETY: a filter primitive cannot take a motion, which is the error under test, so the cast gets past its prop type.
    const flood = def.filter({}, <feFlood animation={motion().to({ [yaw]: 1 }, 1) as never} />);
    expect(() => scene(<rect width={1} height={1} filter={flood} />)).toThrow(
      /cannot animate --yaw:angle/,
    );
  });
});
