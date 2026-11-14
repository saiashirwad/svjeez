import { describe, expect, test } from "bun:test";
import { adaptive, defaultDark, defaultLight, render, variables } from "svjeez";

const scene = (prefix: string, sky: string) => {
  const { vars, css } = variables({ sky }, { sky: "#fff" }, { prefix });

  return render(
    { width: 10, height: 10, duration: 1, title: prefix, prefix, css },
    <rect width={10} height={10} fill={vars.sky} />,
  );
};

describe("scoped theme variables", () => {
  test("each scene's variables apply to its own root only", () => {
    const [a, b] = [scene("a-", "#111"), scene("b-", "#222")];
    expect(a).toContain('class="a-root"');
    expect(a).toContain("svg.a-root{--sky:#111}");
    expect(a).toContain("@media (prefers-color-scheme:light){svg.a-root{--sky:#fff}}");
    expect(b).toContain("svg.b-root{--sky:#222}");

    // Inlined together, no rule from one scene selects the other's root.
    expect(a).not.toContain("b-root");
    expect(b).not.toContain("a-root");
    expect(/(^|[,}\n])svg\{/.test(a + b)).toBe(false);
  });

  test("without a prefix the rule stays on svg", () => {
    expect(variables({ sky: "#111" }).css).toBe("svg{--sky:#111}");
  });

  test("adaptive takes the prefix too", () => {
    expect(adaptive({ dark: defaultDark, light: defaultLight, prefix: "x-" }).css).toContain(
      "svg.x-root{",
    );
  });
});
