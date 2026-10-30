import { describe, expect, test } from "bun:test";
import { CX, dragBy, picture, repainted, shot, source, useApp } from "../helpers/react-app";

const open = useApp();

describe("a scene that declares handles", () => {
  test("dragging a grip moves its value, the source and the picture", async () => {
    const page = await open("handles");
    await page.waitForSelector(".sj-grip");
    const before = await picture(page);
    expect(await source(page)).toContain("x: number(100,");

    await dragBy(page, ".sj-grip", 60);
    const grip = page.locator(".sj-grip");
    const now = Number(await grip.getAttribute("aria-valuenow"));
    expect(now).toBeGreaterThan(100);

    await repainted(page, before);
    expect(await source(page)).toContain(`x: number(${now},`);
    await shot(page, "declared-grip");
    await page.close();
  });
});

describe("a number no one annotated", () => {
  test("selecting it puts a measured grip on the picture, and dragging the grip changes the number", async () => {
    const page = await open();
    await page.locator(CX).focus();
    await page.waitForSelector(".sj-grip", { timeout: 15_000 });
    const before = await picture(page);
    await shot(page, "bare-grip");

    await dragBy(page, ".sj-grip", 40);
    expect(Number(await page.locator(CX).getAttribute("aria-valuenow"))).toBeGreaterThan(120);
    expect(await source(page)).not.toContain("<circle cx={120}");
    await repainted(page, before);
    await page.close();
  });
});
