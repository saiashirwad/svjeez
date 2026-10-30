import { describe, expect, test } from "bun:test";
import { CX, dragBy, source, useApp } from "../helpers/react-app";

const open = useApp();

describe("the control override", () => {
  test("a render prop wraps every control and can keep the built-in one", async () => {
    const page = await open("", "&wrap");
    const wrapped = page.locator(".wrapped");
    expect(await wrapped.count()).toBeGreaterThan(5);
    expect(await page.locator(`.wrapped[data-kind="number"] > ${CX}`).count()).toBe(1);
    await dragBy(page, CX, 30);
    expect(await source(page)).not.toContain("<circle cx={120}");
    await page.close();
  });
});
