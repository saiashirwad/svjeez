import { describe, expect, test } from "bun:test";
import { CX, source, useApp } from "../helpers/react-app";

const open = useApp();

describe("editing a scene with no annotations", () => {
  test("arrow keys step a number, and undo takes back one step at a time", async () => {
    const page = await open();
    await page.locator(CX).focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");

    await page.keyboard.press("Control+z");
    expect(await source(page)).toContain("<circle cx={121}");
    expect(await page.locator(CX).getAttribute("aria-valuenow")).toBe("121");
    await page.close();
  });
});
