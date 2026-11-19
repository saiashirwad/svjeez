import type { Code } from "astro:components";
import type { ComponentProps } from "astro/types";

/** The code colors, light and dark: the examples' theme (examples/theme.ts), so a code block reads like the scenes. */
const ROLES = {
  plain: ["#1D1D1F", "#E5E5EA"],
  comment: ["#6E6E73", "#A1A1A6"],
  punct: ["#6E6E73", "#A1A1A6"],
  keyword: ["#9B51E0", "#C58AFF"],
  fn: ["#0A6CFF", "#5EA0FF"],
  string: ["#2FA84F", "#32D74B"],
  number: ["#E8751A", "#FF9F0A"],
  tag: ["#E5453B", "#FF6961"],
} as const;

type Role = keyof typeof ROLES;

/** `--code-<role>` for each role, as `light-dark()` so it follows the page's scheme. */
export const codeVars = `:root{${Object.entries(ROLES)
  .map(([role, [light, dark]]) => `--code-${role}:light-dark(${light}, ${dark})`)
  .join(";")}}`;

const scope = (scopes: string[], role: Role) => ({
  scope: scopes,
  settings: { foreground: `var(--code-${role})` },
});

export const shikiTheme: ComponentProps<typeof Code>["theme"] = {
  name: "svjeez",
  type: "dark",
  fg: "var(--code-plain)",
  bg: "var(--pre-bg)",
  settings: [
    { settings: { foreground: "var(--code-plain)" } },
    scope(["comment", "punctuation.definition.comment"], "comment"),
    scope(
      [
        "keyword",
        "storage",
        "keyword.operator.new",
        "keyword.operator.expression",
        "variable.language",
      ],
      "keyword",
    ),
    scope(["keyword.operator", "punctuation", "meta.brace"], "punct"),
    scope(["string", "punctuation.definition.string"], "string"),
    scope(["constant.numeric", "constant.language"], "number"),
    scope(
      ["entity.name.function", "support.function", "meta.function-call entity.name.function"],
      "fn",
    ),
    scope(["entity.name.type", "support.type", "support.class", "entity.name.class"], "fn"),
    scope(["entity.name.tag", "support.class.component", "punctuation.definition.tag"], "tag"),
    scope(["entity.other.attribute-name"], "number"),
  ],
};
