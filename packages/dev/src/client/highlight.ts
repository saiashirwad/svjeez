/*
 * A small TypeScript and TSX highlighter: enough to tell keywords, strings, numbers, comments, calls and tags apart
 * at a glance. It reads one file once, with no grammar; text it does not know stays plain.
 */

/** k keyword, s string, n number, c comment, f a call, t a tag or a type. */
export type Tone = "k" | "s" | "n" | "c" | "f" | "t";

export interface Token {
  readonly from: number;
  readonly to: number;
  readonly tone: Tone;
}

const KEYWORDS = new Set(
  (
    "as async await break case catch class const continue declare default delete do else enum export extends " +
    "false finally for from function if import in instanceof interface keyof let new null of readonly return " +
    "satisfies static switch this throw true try type typeof undefined var void while yield"
  ).split(" "),
);

const IDENT = /[A-Za-z_$][\w$]*/y;
const NUMBER = /(?:0[xX][\da-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)n?/y;
const WORD = /[\w$]/;

/** Where a quoted string that opens at `at` ends: after its closing quote, or at the end of its line. */
const stringEnd = (text: string, at: number, quote: string): number => {
  let i = at + 1;

  while (i < text.length) {
    const char = text[i];

    if (char === "\\") i += 2;
    else if (char === quote) return i + 1;
    else if (char === "\n" && quote !== "`") return i;
    else i++;
  }

  return text.length;
};

const before = (text: string, at: number): string => {
  let i = at - 1;

  while (i >= 0 && (text[i] === " " || text[i] === "\t")) i--;

  return text[i] ?? "";
};

const after = (text: string, at: number): string => {
  let i = at;

  while (i < text.length && (text[i] === " " || text[i] === "\t")) i++;

  return text[i] ?? "";
};

/** The tokens worth a color, in order and never overlapping. */
export const tokenize = (text: string): readonly Token[] => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < text.length) {
    const char = text[i] ?? "";
    const next = text[i + 1] ?? "";

    if (char === "/" && next === "/") {
      const end = text.indexOf("\n", i);
      const to = end === -1 ? text.length : end;

      tokens.push({ from: i, to, tone: "c" });
      i = to;
    } else if (char === "/" && next === "*") {
      const end = text.indexOf("*/", i + 2);
      const to = end === -1 ? text.length : end + 2;

      tokens.push({ from: i, to, tone: "c" });
      i = to;
    } else if (char === '"' || char === "'" || char === "`") {
      const to = stringEnd(text, i, char);

      tokens.push({ from: i, to, tone: "s" });
      i = to;
    } else if (/\d/.test(char) || (char === "." && /\d/.test(next))) {
      NUMBER.lastIndex = i;
      const match = WORD.test(text[i - 1] ?? "") ? null : NUMBER.exec(text);
      const to = match ? i + match[0].length : i + 1;

      if (match) tokens.push({ from: i, to, tone: "n" });
      i = to;
    } else if (/[A-Za-z_$]/.test(char)) {
      IDENT.lastIndex = i;
      const word = IDENT.exec(text)?.[0] ?? char;
      const to = i + word.length;
      const prev = before(text, i);

      const tone: Tone | undefined =
        KEYWORDS.has(word) && prev !== "." && (word !== "from" || /["'`]/.test(after(text, to)))
          ? "k"
          : prev === "<" || (prev === "/" && text[i - 2] === "<")
            ? "t"
            : after(text, to) === "("
              ? "f"
              : /^[A-Z][a-z]/.test(word)
                ? "t"
                : undefined;

      if (tone) tokens.push({ from: i, to, tone });
      i = to;
    } else i++;
  }

  return tokens;
};
