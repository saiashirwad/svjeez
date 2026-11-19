import type { Code } from "astro:components";
import type { ComponentProps } from "astro/types";
import { CODE, DEFAULT_PALETTE, PALETTES, type Name, type Palette } from "../palettes";

const pair = ({ light, dark }: { light: string; dark: string }) => `light-dark(${light}, ${dark})`;

/** The page's code roles, each painted like the code role of a scene's code (palettes.ts). */
const ROLES = {
  plain: "plain",
  comment: "comment",
  punct: "punctuation",
  keyword: "keyword",
  fn: "function",
  string: "string",
  number: "number",
  tag: "tag",
} as const satisfies Record<string, keyof typeof CODE>;

type Role = keyof typeof ROLES;

/** The page's own colors under another palette, by the token that paints each. */
const PAGE = {
  bg: "background",
  surface: "surface",
  sunken: "surface",
  band: "surface",
  "win-bg": "background",
  line: "raised",
  muted: "muted",
  ink: "text",
  accent: "green",
  "accent-ink": "background",
} as const satisfies Record<string, Name>;

const roles = ({ theme }: Palette) =>
  Object.entries(ROLES).map(([role, code]) => `--code-${role}:${pair(theme[CODE[code]])}`);

const page = ({ theme }: Palette) =>
  Object.entries(PAGE).map(([token, name]) => `--${token}:${pair(theme[name])}`);

/** `--code-<role>` for each role, and for every palette but the default its code roles and page tokens under `:root[data-palette]`. */
export const codeVars = [
  `:root{${roles(PALETTES[0]).join(";")}}`,
  ...PALETTES.filter(({ id }) => id !== DEFAULT_PALETTE).map(
    (p) => `:root[data-palette="${p.id}"]{${[...roles(p), ...page(p)].join(";")}}`,
  ),
].join("\n");

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
