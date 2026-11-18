import { describe, expect, test } from "bun:test";
import toml from "shiki/langs/toml.mjs";
import { SceneError } from "svjeez/tools";
import { highlight } from "../src/index.ts";

const spelled = (lines: ReturnType<typeof highlight>) =>
  lines.map((line) => line.map(([, text]) => text).join(""));

const thrownBy = (run: () => void): SceneError => {
  try {
    run();
  } catch (error) {
    if (error instanceof SceneError) return error;

    throw error;
  }

  throw new Error("nothing was thrown");
};

const rolesOf = (lang: string, source: string) =>
  new Set(highlight(source, lang).flatMap((line) => line.map(([role]) => role)));

describe("highlight", () => {
  test("tags every run with a role", () => {
    expect(highlight("const x = 1;", "ts")).toEqual([
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
    const lines = highlight("a\n\n// b\n", "ts");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]).toEqual([["comment", "// b"]]);
  });

  test("the runs of a line spell the source line", () => {
    const source = 'export const f = async (a: string) => <A b="c">{a}</A>;';

    expect(spelled(highlight(source, "tsx"))).toEqual([source]);
  });

  test("merges adjacent runs of one role", () => {
    expect(highlight("// one two three", "ts")[0]).toEqual([["comment", "// one two three"]]);
  });

  test("expands tabs to the next tab stop, counting code points", () => {
    expect(spelled(highlight("\tx\ty", "js", { tabSize: 4 }))).toEqual(["    x   y"]);
    expect(spelled(highlight("\tx", "js"))).toEqual(["  x"]);
    expect(spelled(highlight("😀\tx", "js", { tabSize: 4 }))).toEqual(["😀   x"]);
  });

  test("accepts CRLF input", () => {
    expect(highlight("a\r\nb", "js")).toHaveLength(2);
  });

  test("knows the bundled languages and their aliases", () => {
    expect(rolesOf("bash", 'echo "$HOME" # hi').has("comment")).toBe(true);
    expect(rolesOf("sh", "ls -la").has("function")).toBe(true);
    expect(rolesOf("py", "def f():\n  return None").has("keyword")).toBe(true);
    expect(rolesOf("rs", "fn main() {}").has("function")).toBe(true);
    expect(rolesOf("go", "func main() {}").has("keyword")).toBe(true);
    expect(rolesOf("sql", "SELECT 1 FROM t").has("keyword")).toBe(true);
    expect(rolesOf("yaml", "a: 1").has("variable")).toBe(true);
    expect(rolesOf("json", '{"a": true}').has("constant")).toBe(true);
    expect(rolesOf("css", "a { color: red; }").has("variable")).toBe(true);
    expect(rolesOf("html", "<p>hi</p>").has("tag")).toBe(true);
    expect(rolesOf("md", "# Title").has("keyword")).toBe(true);
    expect(rolesOf("diff", "-a\n+b")).toEqual(new Set(["deleted", "inserted"]));
  });

  test("an unknown language says what it knows and how to add one", () => {
    const error = thrownBy(() => highlight("x", "cobol"));

    expect(error.problem).toMatch(
      /^"cobol" is not a language @svjeez\/code knows\. It knows: .*\brust\b.*\btsx\b/,
    );
    expect(error.fix).toContain("grammars={[toml]}");
  });

  test("an extra grammar adds a language", () => {
    expect(() => highlight("a = 1", "toml")).toThrow(/"toml" is not a language/);

    expect(highlight('name = "svjeez"', "toml", { grammars: [toml] })[0]).toContainEqual([
      "string",
      '"svjeez"',
    ]);
  });

  test("a bad tab size says what to give", () => {
    expect(() => highlight("x", "js", { tabSize: 0 })).toThrow(
      "tabSize is 0. Give a whole number of at least 1, the spaces a tab becomes.",
    );
  });
});
