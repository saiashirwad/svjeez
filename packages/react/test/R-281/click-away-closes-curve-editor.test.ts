import { describe, expect, test } from "bun:test";
import { useApp } from "../helpers/react-app";

const open = useApp();

describe("editing a scene with no annotations", () => {
  test("clicking away from the curve editor closes it and leaves nothing selected", async () => {
    const page = await open();
    await page.locator(".sj-ease", { hasText: "ease.out" }).locator(".sj-glyph").click();
    await page.locator(".sj-pop").waitFor();
    expect(await page.locator(".sj-ease[data-selected]").count()).toBe(1);

    await page.getByRole("button", { name: "Undo" }).click();
    await page.locator(".sj-pop").waitFor({ state: "detached" });
    expect(await page.locator(".sj-ease[data-selected]").count()).toBe(0);
    await page.close();
  });
});
