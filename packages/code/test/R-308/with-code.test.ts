import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { adaptive, code, defaultDark, systemDark, systemLight, tint } from "svjeez/extras";
import { highlight } from "../../src/index.ts";

describe("with code()", () => {
  const source = 'const greeting = "hi";';

  test("colors come from the theme", () => {
    const keyword = code(highlight(source, "ts"), { theme: defaultDark }).words[0];

    expect(keyword?.color).toBe(tint(defaultDark, "keyword"));
  });

  test("an adaptive theme switches with the color scheme instead of baking in hex", () => {
    const { theme, css } = adaptive({ light: systemLight, dark: systemDark });

    const svg = render(
      { width: 400, height: 80, duration: 1, title: "Code", css },
      code(highlight(source, "ts"), { x: 10, y: 10, theme }).node,
    );

    expect(svg).toContain(`fill="${tint(theme, "keyword")}"`);
    expect(svg).toContain("prefers-color-scheme");
    expect(svg).not.toContain("#000004");
  });
});
