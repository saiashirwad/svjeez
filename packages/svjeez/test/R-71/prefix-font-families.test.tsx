import { describe, expect, test } from "bun:test";
import { font, render } from "svjeez";

describe("prefix", () => {
  test("a prefix renames embedded font families in the rule and its uses", async () => {
    const sans = await font.load(new URL("../fixtures/ABeeZee-Regular.ttf", import.meta.url));

    const svg = render(
      { width: 100, height: 100, duration: 1, title: "F", prefix: "one-" },
      <text fontFamily={sans}>Hi</text>,
    );

    expect(svg).toContain("@font-face{font-family:'one-ABeeZee'");
    expect(svg).toContain(`font-family="'one-ABeeZee', sans-serif"`);
  });
});
