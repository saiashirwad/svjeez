import { describe, expect, test } from "bun:test";
import { type LanguageRegistration } from "shiki/core";
import ruby from "shiki/langs/ruby.mjs";
import toml from "shiki/langs/toml.mjs";
import * as code from "../src/index.ts";
import { highlight, html, js, md, ts, tsx, type CodeRole, type Lang } from "../src/index.ts";

const spelled = (lines: ReturnType<typeof highlight>) =>
  lines.map((line) => line.map(([, text]) => text).join(""));

const isRegistration = (value: unknown): value is LanguageRegistration =>
  typeof value === "object" && value !== null && "name" in value;

const isGrammar = (entry: [string, unknown]): entry is [string, LanguageRegistration[]] =>
  Array.isArray(entry[1]) && entry[1].every(isRegistration);

const rolesOf = (lang: Lang, source: string) =>
  new Set(highlight(source, lang).flatMap((line) => line.map(([role]) => role)));

describe("highlight", () => {
  test("tags every run with a role", () => {
    expect(highlight("const x = 1;", ts)).toEqual([
      [
        ["keyword", "const"],
        ["plain", " x "],
        ["punctuation", "="],
        ["plain", " "],
        ["number", "1"],
        ["punctuation", ";"],
      ],
    ]);
  });

  test("returns one array per line and gives an empty line no runs", () => {
    const lines = highlight("a\n\n// b\n", ts);

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]).toEqual([["comment", "// b"]]);
  });

  test("the runs of a line spell the source line", () => {
    const source = 'export const f = async (a: string) => <A b="c">{a}</A>;';

    expect(spelled(highlight(source, tsx))).toEqual([source]);
  });

  test("merges adjacent runs of one role", () => {
    expect(highlight("// one two three", ts)[0]).toEqual([["comment", "// one two three"]]);
  });

  test("expands tabs to the next tab stop, counting code points", () => {
    expect(spelled(highlight("\tx\ty", js, { tabSize: 4 }))).toEqual(["    x   y"]);
    expect(spelled(highlight("\tx", js))).toEqual(["  x"]);
    expect(spelled(highlight("😀\tx", js, { tabSize: 4 }))).toEqual(["😀   x"]);
  });

  test("accepts CRLF input", () => {
    expect(highlight("a\r\nb", js)).toHaveLength(2);
  });

  test("highlights source in every grammar it exports", () => {
    const samples = {
      bash: ['echo "$HOME" # hi', "comment"],
      css: ["a { color: red; }", "variable"],
      diff: ["-a\n+b", "deleted"],
      go: ["func main() {}", "keyword"],
      html: ["<p>hi</p>", "tag"],
      js: ["const f = () => 1;", "keyword"],
      json: ['{"a": true}', "constant"],
      jsx: ['<a href="#">x</a>', "tag"],
      md: ["# Title", "keyword"],
      ocaml: ["let answer = 42", "keyword"],
      python: ["def f():\n  return None", "keyword"],
      rust: ["fn main() {}", "function"],
      sql: ["SELECT 1 FROM t", "keyword"],
      ts: ["const x: number = 1;", "keyword"],
      tsx: ["const a = <span n={1} />;", "tag"],
      yaml: ["a: 1", "variable"],
    } satisfies Record<string, readonly [source: string, role: CodeRole]>;

    const grammars = new Map(Object.entries(code).filter(isGrammar));

    expect([...grammars.keys()].toSorted()).toEqual(Object.keys(samples).toSorted());

    for (const [name, [source, role]] of Object.entries(samples))
      expect(rolesOf(grammars.get(name)!, source), name).toContain(role);
  });

  test("the root exports the authoring API alongside the grammars", () => {
    const names = Object.entries(code)
      .filter((entry) => !isGrammar(entry))
      .map(([name]) => name)
      .toSorted();

    expect(names).toEqual(["Code", "ROLES", "codeLayout", "codeTokens", "highlight", "lines"]);
  });

  test("any other Shiki grammar highlights the same way", () => {
    expect(highlight('name = "svjeez"', toml)[0]).toContainEqual(["string", '"svjeez"']);
  });

  test("a grammar brings the grammars embedded in it", () => {
    expect(rolesOf(html, "<style>a { color: red; }</style>")).toContain("variable");
    expect(rolesOf(html, "<script>const a = 1;</script>")).toContain("keyword");
  });

  test("a list loads every grammar in it and highlights as the last one", () => {
    const fence = "```ruby\ndef f; end\n```";

    expect(rolesOf(md, fence)).not.toContain("keyword");
    expect(rolesOf([ruby, md], fence)).toContain("keyword");
    expect(highlight("def f; end", [ruby, md])[0]).toEqual([["plain", "def f; end"]]);
  });

  test("a list with no grammar in it says what to give", () => {
    expect(() => highlight("x", [])).toThrow(
      "lang is an empty list of grammars. Give a grammar, such as ts from @svjeez/code, or a list that ends in one.",
    );
  });

  test("a bad tab size says what to give", () => {
    expect(() => highlight("x", js, { tabSize: 0 })).toThrow(
      "tabSize is 0. Give a whole number of at least 1, the spaces a tab becomes.",
    );
  });
});
