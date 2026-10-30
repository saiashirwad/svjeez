import { describe, expect, test } from "bun:test";
import { code } from "svjeez/extras";
import { sans } from "../helpers/font";

describe("extras with a font", () => {
  test("code() rejects a proportional font", () => {
    expect(() => code("x", { font: sans })).toThrow("needs a monospaced font");
  });
});
