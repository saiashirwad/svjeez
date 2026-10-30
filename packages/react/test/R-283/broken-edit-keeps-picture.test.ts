import { describe, expect, test } from "bun:test";
import { picture, shot, useApp } from "../helpers/react-app";

const open = useApp();

describe("editing a scene with no annotations", () => {
  test("a broken edit shows its error while the last good picture stays", async () => {
    const page = await open();
    const good = await picture(page);
    await page.getByRole("button", { name: "Break" }).click();
    await page.locator(".sj-error:not([hidden])").waitFor();

    expect(await page.locator(".sj-error").textContent()).toBeTruthy();
    expect(await picture(page)).toBe(good);
    await shot(page, "broken");
    await page.close();
  });
});
