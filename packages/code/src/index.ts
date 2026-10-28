import type { CodeRole, CodeRun } from "svjeez/extras";
import {
  createHighlighterCoreSync,
  type LanguageRegistration,
  type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { LANGS, type DefaultLang } from "./langs.ts";
import { SCOPES } from "./scopes.ts";

export type { CodePiece, CodeRole, CodeTokens } from "svjeez/extras";

export type { DefaultLang } from "./langs.ts";

/** What `highlight()` returns: a `CodeTokens` whose pieces are all plain strings or `[role, text]` runs. */
export type Highlighted = readonly (readonly (string | CodeRun)[])[];

/** A language this package bundles, an alias of one, or the name of a grammar passed in `grammars`. */
export type Lang = DefaultLang | (string & {});

export interface HighlightOptions {
  /** Spaces per tab stop. Tabs become spaces because `code()` lays out one column per character. Default 2. */
  readonly tabSize?: number;
  /** Extra Shiki grammars, such as `import toml from "shiki/langs/toml.mjs"`. Each loads once. */
  readonly grammars?: readonly (LanguageRegistration | LanguageRegistration[])[];
}

/** Each role gets a color no theme would use, so a token's color names its role. */
const ROLES: readonly CodeRole[] = ["plain", ...new Set<CodeRole>(Object.values(SCOPES))];
const sentinel = (role: CodeRole) => `#${(ROLES.indexOf(role) + 1).toString(16).padStart(6, "0")}`;
const roleOf = new Map(ROLES.map((role) => [sentinel(role), role]));

const THEME: ThemeRegistration & { name: string } = {
  name: "svjeez-roles",
  type: "dark",
  fg: sentinel("plain"),
  bg: "#000000",
  settings: [
    { settings: { foreground: sentinel("plain"), background: "#000000" } },
    ...Object.entries(SCOPES).map(([scope, role]) => ({
      scope,
      settings: { foreground: sentinel(role) },
    })),
  ],
};

const highlighter = createHighlighterCoreSync({
  themes: [THEME],
  langs: LANGS,
  engine: createJavaScriptRegexEngine(),
});

const loaded = new WeakSet<object>();

const supported = () => highlighter.getLoadedLanguages().toSorted();

const expandTabs = (line: string, tabSize: number): string => {
  let out = "";

  for (const ch of line) out += ch === "\t" ? " ".repeat(tabSize - (out.length % tabSize)) : ch;

  return out;
};

/**
 * Splits `source` into lines of role-tagged runs, ready for `code()`. Runs of the same role are merged, and
 * plain text is a bare string. Colors come from the scene's theme, so `adaptive()` and `variables()` keep working.
 */
export function highlight(source: string, lang: Lang, options: HighlightOptions = {}): Highlighted {
  const { tabSize = 2, grammars = [] } = options;

  if (!Number.isInteger(tabSize) || tabSize < 1) {
    throw new Error(
      `highlight() needs tabSize to be a whole number of at least 1, got ${tabSize}.`,
    );
  }

  for (const grammar of grammars) {
    if (loaded.has(grammar)) continue;
    highlighter.loadLanguageSync(grammar);
    loaded.add(grammar);
  }

  if (!highlighter.getLoadedLanguages().includes(lang)) {
    throw new Error(
      `highlight() does not know the language "${lang}". It knows: ${supported().join(", ")}. ` +
        `Pass another grammar in options.grammars, such as import toml from "shiki/langs/toml.mjs".`,
    );
  }

  const text = source
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => expandTabs(line, tabSize))
    .join("\n");

  // Past Shiki's default 500ms per line, the rest of the line comes back as one token in the current color. The
  // first call compiles the grammar's regexes, which can take that long on a slow machine.
  const lines = highlighter.codeToTokensBase(text, {
    lang,
    theme: THEME.name,
    tokenizeTimeLimit: 0,
  });

  return lines.map((tokens) => {
    const runs: [CodeRole, string][] = [];

    for (const token of tokens) {
      const content = token.content;
      const role = roleOf.get(token.color?.toLowerCase() ?? "") ?? "plain";
      const last = runs.at(-1);

      if (last?.[0] === role) last[1] += content;
      else runs.push([role, content]);
    }

    return runs.map(([role, content]): string | CodeRun =>
      role === "plain" ? content : [role, content],
    );
  });
}
