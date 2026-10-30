import { describe, expect, test } from "bun:test";
import { CX, dragBy, picture, repainted, shot, source, useApp } from "../helpers/react-app";

const open = useApp();

describe("editing a scene with no annotations", () => {
  test("dragging a number rewrites the source and recompiles the picture", async () => {
    const page = await open();
    const before = await picture(page);
    expect(await source(page)).toContain("<circle cx={120}");

    await dragBy(page, CX, 60);
    const text = await source(page);
    expect(text).not.toContain("<circle cx={120}");
    expect(text).toMatch(/<circle cx=\{\d+(\.\d+)?\}/);

    await repainted(page, before);
    expect(await picture(page)).not.toBe(before);
    await shot(page, "number-dragged");
    await page.close();
  });

  test("undo takes a whole drag back in one step", async () => {
    const page = await open();
    const original = await source(page);
    await dragBy(page, CX, 80);
    expect(await source(page)).not.toBe(original);

    await page.getByRole("button", { name: "Undo" }).click();
    expect(await source(page)).toBe(original);
    await page.close();
  });

  test("arrow keys step a number, and undo takes back one step at a time", async () => {
    const page = await open();
    await page.locator(CX).focus();
    await page.keyboard.press("ArrowUp");
    await page.keyboard.press("ArrowUp");
    expect(await source(page)).toContain("<circle cx={122}");
    await page.close();
  });

  test("picking a color writes the hex", async () => {
    const page = await open();
    const swatch = page.locator(".sj-color .sj-swatch").nth(1);
    await swatch.fill("#112233");

    const text = await source(page);
    expect(text).toContain('<circle cx={120} cy={120} r={30} fill="#112233"');
    expect(text).not.toContain("#FF5D8F");
    await shot(page, "color-picked");
    await page.close();
  });

  test("bending an ease writes ease.bezier", async () => {
    const page = await open();
    await page.locator(".sj-ease", { hasText: "ease.out" }).locator(".sj-glyph").click();
    const handle = page.locator(".sj-pop .sj-handle").first();
    await handle.waitFor();
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y - 30, { steps: 5 });
    await page.mouse.up();

    expect(await page.locator(".sj-pop-text").textContent()).toMatch(/^ease\.bezier\(/);
    expect(await source(page)).toMatch(/to\(\{ rotate: 90 \}, 1\.5, ease\.bezier\(/);
    await shot(page, "ease-bent");

    await page.keyboard.press("Escape");
    await page.locator(".sj-pop").waitFor({ state: "detached" });
    await page.close();
  });
});
