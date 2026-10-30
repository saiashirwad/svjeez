import { describe, expect, test } from "bun:test";
import { rect } from "svjeez";
import { appWindow } from "svjeez/extras";

describe("terminal", () => {
  test("a window's body starts under its title bar", () => {
    expect(appWindow(rect(0, 0, 100, 80), { bar: 30 }).body).toMatchObject({
      x: 0,
      y: 30,
      w: 100,
      h: 50,
    });
  });
});
