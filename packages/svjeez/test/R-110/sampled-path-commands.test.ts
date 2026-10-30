import { describe, expect, test } from "bun:test";
import { sampledPath } from "svjeez";

describe("sampledPath", () => {
  test("rejects samples with different commands", () => {
    expect(() =>
      sampledPath((t) => (t < 1 ? "M0 0L1 1" : "M0 0L1 1L2 2"), { duration: 2, tolerance: 1 }),
    ).toThrow("sampledPath() returned a path with different commands at t=1 than at t=0.");
  });
});
