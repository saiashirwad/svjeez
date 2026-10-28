// The code palette as CSS custom properties, from the same palette the example scenes use, and the page in every other palette.
import type { Code } from "astro:components";
import type { ComponentProps } from "astro/types";
import { tint, type CodeRole, type Slot } from "svjeez/extras";
import { palette } from "@examples/style";
import { DEFAULT_PALETTE, PALETTES, type Palette } from "../palettes";

const ROLES = ["plain", "muted", "comment", "punct", "keyword", "fn", "string", "number", "type", "tag"] as const satisfies readonly CodeRole[];
const pair = (light: string, dark: string) => `light-dark(${light}, ${dark})`;
type Pair = Pick<Palette, "light" | "dark">;
const roles = ({ light, dark }: Pair) => ROLES.map((role) => `--code-${role}:${pair(tint(light, role), tint(dark, role))}`);

/** The page tokens of site.css, drawn from a palette's slots. */
const TOKENS = {
  bg: "base00",
  surface: "base01",
  sunken: "base01",
  band: "base01",
  "win-bg": "base00",
  line: "base02",
  muted: "base04",
  ink: "base05",
  accent: "base0B",
  "accent-ink": "base00",
} as const satisfies Record<string, Slot>;
const tokens = ({ light, dark }: Pair) => Object.entries(TOKENS).map(([token, slot]) => `--${token}:${pair(light[slot], dark[slot])}`);

/** `--code-<role>` for each role, and for every palette but the default its code roles and page tokens under `:root[data-palette]`. */
export const codeVars = [
  `:root{${roles(palette).join(";")}}`,
  ...PALETTES.filter(({ id }) => id !== DEFAULT_PALETTE).map((p) => `:root[data-palette="${p.id}"]{${[...roles(p), ...tokens(p)].join(";")}}`),
].join("\n");

const scope = (scopes: string[], role: CodeRole) => ({ scope: scopes, settings: { foreground: `var(--code-${role})` } });

/** A Shiki theme that colors tokens the way the playground's editor and the scenes do, through the same variables. */
export const shikiTheme: ComponentProps<typeof Code>["theme"] = {
  name: "svjeez",
  type: "dark",
  fg: "var(--code-plain)",
  bg: "var(--pre-bg)",
  settings: [
    { settings: { foreground: "var(--code-plain)" } },
    scope(["comment", "punctuation.definition.comment"], "comment"),
    scope(["keyword", "storage", "keyword.operator.new", "keyword.operator.expression", "variable.language"], "keyword"),
    scope(["keyword.operator", "punctuation", "meta.brace"], "punct"),
    scope(["string", "punctuation.definition.string"], "string"),
    scope(["constant.numeric", "constant.language"], "number"),
    scope(["entity.name.function", "support.function", "meta.function-call entity.name.function"], "fn"),
    scope(["entity.name.type", "support.type", "support.class", "entity.name.class"], "fn"),
    scope(["entity.name.tag", "support.class.component", "punctuation.definition.tag"], "tag"),
    scope(["entity.other.attribute-name"], "number"),
  ],
};
