import { describe, expect, test } from "bun:test";
import { adaptive, defaultDark, defaultLight, variables } from "svjeez/extras";

describe("themes", () => {
  test("adaptive colors are variables that switch to the light scheme under prefers-color-scheme: light", () => {
    const { theme, css } = adaptive({ dark: defaultDark, light: defaultLight });
    expect(theme.base00).toBe("var(--base00)");
    const [dark, light] = css.split("@media (prefers-color-scheme:light)");
    expect(dark).toContain(`--base00:${defaultDark.base00}`);
    expect(light).toContain(`--base00:${defaultLight.base00}`);
  });

  test("variables() names each value as a CSS variable, with the light values under prefers-color-scheme: light", () => {
    const { vars, css } = variables(
      { sky: "#001", "ground-2": "#010" },
      { sky: "#ddf", "ground-2": "#dfd" },
    );

    expect(vars).toEqual({ sky: "var(--sky)", "ground-2": "var(--ground-2)" });
    expect(css).toBe(
      "svg{--sky:#001;--ground-2:#010}\n@media (prefers-color-scheme:light){svg{--sky:#ddf;--ground-2:#dfd}}",
    );
    expect(variables({ sky: "#001" }).css).toBe("svg{--sky:#001}");
  });

  test("variables() rejects a name that is not a CSS identifier", () => {
    expect(() => variables({ "not valid": "#000" })).toThrow(
      'variables() needs CSS identifiers for names, got "not valid".',
    );
  });

  test("adaptive() emits one declaration per base16 slot, dark first", () => {
    const { css } = adaptive({ dark: defaultDark, light: defaultLight });

    const slots = (scheme: typeof defaultDark) =>
      Object.entries(scheme)
        .map(([slot, color]) => `--${slot}:${color}`)
        .join(";");

    expect(css).toBe(
      `svg{${slots(defaultDark)}}\n@media (prefers-color-scheme:light){svg{${slots(defaultLight)}}}`,
    );
  });
});
