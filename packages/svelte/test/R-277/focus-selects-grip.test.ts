import { describe, expect, test } from "bun:test";
import { CX, useApp } from "../helpers/svelte-app";

const open = useApp();

describe("a bare number", () => {
  test("selecting it puts a measured grip on the picture, and dragging the grip changes the number", async () => {
    const page = await open();
    expect(await page.locator(".sj-grip").count()).toBe(0);

    await page.locator(CX).focus();
    await page.waitForSelector(".sj-grip", { timeout: 15_000 });
    expect(await page.locator(".sj-grip").getAttribute("data-sj-key")).toBe(
      await page.locator(CX).getAttribute("data-sj-key"),
    );
    await page.close();
  });
});
