import { describe, expect, test } from "bun:test";
import { code } from "svjeez/extras";
import { mono } from "../helpers/font";

describe("extras with a font", () => {
  test("code() takes its column width from a monospaced font", () => {
    const block = code("let x = 1", { font: mono, fontSize: 20 });
    expect(block.metrics.advance).toBeCloseTo(mono.measure("x", 20), 6);
  });
});
