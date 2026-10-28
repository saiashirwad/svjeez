// The code palette as CSS custom properties, from the same palette the example scenes use.
import type { Code } from "astro:components";
import type { ComponentProps } from "astro/types";
import { tint, type CodeRole } from "svjeez/extras";
import { palette } from "@examples/style";

const ROLES = ["plain", "muted", "comment", "punct", "keyword", "fn", "string", "number", "type", "tag"] as const satisfies readonly CodeRole[];
const color = (role: CodeRole) => `light-dark(${tint(palette.light, role)}, ${tint(palette.dark, role)})`;

/** `--code-<role>` for each role. */
export const codeVars = `:root{${ROLES.map((role) => `--code-${role}:${color(role)}`).join(";")}}`;

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
