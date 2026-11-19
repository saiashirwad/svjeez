import {
  createHighlighterCoreSync,
  type LanguageRegistration,
  type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { SceneError } from "svjeez/tools";
import { LANGS, type DefaultLang } from "./langs.ts";
import { ROLES, type CodeRole } from "./roles.ts";
import { SCOPES } from "./scopes.ts";

export type { DefaultLang } from "./langs.ts";

export type Piece = readonly [role: CodeRole, text: string];

export type Highlighted = readonly (readonly Piece[])[];

export type Lang = DefaultLang | (string & {});

export type Grammar = LanguageRegistration | LanguageRegistration[];

export interface HighlightOptions {
  readonly tabSize?: number;
  readonly grammars?: readonly Grammar[];
}

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

let shiki: ReturnType<typeof createHighlighterCoreSync> | undefined;

const highlighterOf = () =>
  (shiki ??= createHighlighterCoreSync({
    themes: [THEME],
    langs: LANGS,
    engine: createJavaScriptRegexEngine(),
  }));

const loaded = new WeakSet<object>();

const expandTabs = (line: string, tabSize: number): string => {
  let out = "";
  let column = 0;

  for (const char of line) {
    if (char === "\t") {
      const pad = tabSize - (column % tabSize);

      out += " ".repeat(pad);
      column += pad;
    } else {
      out += char;
      column++;
    }
  }

  return out;
};

const checkTabSize = (tabSize: number): void => {
  if (!Number.isInteger(tabSize) || tabSize < 1)
    throw new SceneError(
      `tabSize is ${tabSize}.`,
      "Give a whole number of at least 1, the spaces a tab becomes.",
    );
};

export const highlight = (
  source: string,
  lang: Lang,
  { tabSize = 2, grammars = [] }: HighlightOptions = {},
): Highlighted => {
  checkTabSize(tabSize);
  const highlighter = highlighterOf();

  for (const grammar of grammars) {
    if (loaded.has(grammar)) continue;
    highlighter.loadLanguageSync(grammar);
    loaded.add(grammar);
  }

  const known = highlighter.getLoadedLanguages();

  if (!known.includes(lang))
    throw new SceneError(
      `"${lang}" is not a language @svjeez/code knows. It knows: ${known.toSorted().join(", ")}.`,
      'Use one of those, or add its grammar: grammars={[toml]} after import toml from "shiki/langs/toml.mjs".',
    );

  const text = source
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => expandTabs(line, tabSize))
    .join("\n");

  const lines = highlighter.codeToTokensBase(text, {
    lang,
    theme: THEME.name,
    tokenizeTimeLimit: 0,
  });

  return lines.map((tokens) => {
    const pieces: [CodeRole, string][] = [];

    for (const { content, color } of tokens) {
      const role = roleOf.get(color?.toLowerCase() ?? "") ?? "plain";
      const last = pieces.at(-1);

      if (last?.[0] === role) last[1] += content;
      else pieces.push([role, content]);
    }

    return pieces;
  });
};
