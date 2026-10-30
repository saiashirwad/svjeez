import { describe, expect, test } from "bun:test";
import { CX, dragBy, picture, repainted, source, useApp } from "../helpers/react-app";

const open = useApp();

describe("React's rendering rules", () => {
  test("a memo'd picture still shows each new compile", async () => {
    const page = await open("", "&memo");
    const before = await picture(page);

    await dragBy(page, CX, 60);
    await repainted(page, before);
    expect(await picture(page)).not.toBe(before);
    await page.close();
  }, 40_000);

  test("an editor hidden by <Activity> and shown again still edits and recompiles", async () => {
    const page = await open("", "&hideable");
    await page.getByRole("button", { name: "Hide" }).click();
    await page.getByRole("button", { name: "Show" }).click();
    await page.locator(CX).waitFor({ state: "visible" });
    const before = await picture(page);

    await dragBy(page, CX, 60);
    expect(await source(page)).not.toContain("<circle cx={120}");
    await repainted(page, before);
    await page.close();
  }, 40_000);
});
