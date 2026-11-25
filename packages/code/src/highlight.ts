import {
  createHighlighterCoreSync,
  type LanguageRegistration,
  type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { SceneError } from "svjeez/tools";
import { ROLES, type CodeRole } from "./roles.ts";
import { SCOPES } from "./scopes.ts";

export type Piece = readonly [role: CodeRole, text: string];

export type Highlighted = readonly (readonly Piece[])[];

/** A Shiki grammar: one that `@svjeez/code` exports, or any language's own module, as `import toml from "shiki/langs/toml.mjs"`. A list loads them all and highlights as the last one, so `[ts, bash, md]` is Markdown whose fenced code is TypeScript or Bash. */
export type Lang = LanguageRegistration | readonly Lang[];

export interface HighlightOptions {
  readonly tabSize?: number;
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
    engine: createJavaScriptRegexEngine(),
  }));

const loaded = new Set<string>();

const isList = (lang: Lang): lang is readonly Lang[] => Array.isArray(lang);

const registrationsOf = (lang: Lang): LanguageRegistration[] =>
  isList(lang) ? lang.flatMap(registrationsOf) : [lang];

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

/** The source's lines as `<Code>` lays them out: line endings unified, a final newline dropped, tabs expanded. */
export const sourceLines = (source: string, tabSize = 2): string[] => {
  if (!Number.isInteger(tabSize) || tabSize < 1)
    throw new SceneError(
      `tabSize is ${tabSize}.`,
      "Give a whole number of at least 1, the spaces a tab becomes.",
    );

  return source
    .replace(/\r\n?/g, "\n")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => expandTabs(line, tabSize));
};

export const highlight = (
  source: string,
  lang: Lang,
  { tabSize = 2 }: HighlightOptions = {},
): Highlighted => {
  const text = sourceLines(source, tabSize).join("\n");
  const grammars = registrationsOf(lang);
  const language = grammars.at(-1);

  if (!language)
    throw new SceneError(
      "lang is an empty list of grammars.",
      "Give a grammar, such as ts from @svjeez/code, or a list that ends in one.",
    );

  const highlighter = highlighterOf();

  if (grammars.some(({ name }) => !loaded.has(name))) {
    highlighter.loadLanguageSync(...grammars);

    for (const { name } of grammars) loaded.add(name);
  }

  const lines = highlighter.codeToTokensBase(text, {
    lang: language.name,
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
