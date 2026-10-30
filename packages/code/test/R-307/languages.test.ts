import { describe, expect, test } from "bun:test";
import toml from "shiki/langs/toml.mjs";
import { highlight } from "../../src/index.ts";

describe("highlight", () => {
  test("takes aliases and the other default languages", () => {
    const roles = (lang: string, source: string) =>
      new Set(
        highlight(source, lang).flatMap((line) =>
          line.flatMap((p) => (Array.isArray(p) ? [p[0]] : [])),
        ),
      );

    expect(roles("bash", 'echo "$HOME" # hi').has("comment")).toBe(true);
    expect(roles("sh", "ls -la").has("fn")).toBe(true);
    expect(roles("py", "def f():\n  return None").has("keyword")).toBe(true);
    expect(roles("rs", "fn main() {}").has("fn")).toBe(true);
    expect(roles("go", "func main() {}").has("keyword")).toBe(true);
    expect(roles("sql", "SELECT 1 FROM t").has("keyword")).toBe(true);
    expect(roles("yaml", "a: 1").has("variable")).toBe(true);
    expect(roles("json", '{"a": true}').has("constant")).toBe(true);
    expect(roles("css", "a { color: red; }").has("variable")).toBe(true);
    expect(roles("html", "<p>hi</p>").has("tag")).toBe(true);
    expect(roles("md", "# Title").has("keyword")).toBe(true);
    expect(roles("diff", "-a\n+b").has("red")).toBe(true);
    expect(roles("diff", "-a\n+b").has("green")).toBe(true);
  });

  test("an unknown language throws and lists the languages it knows", () => {
    expect(() => highlight("x", "cobol")).toThrow(
      /highlight\(\) does not know the language "cobol"\. It knows: .*\brust\b.*\btsx\b.*options\.grammars/,
    );
  });

  test("an extra grammar adds a language", () => {
    expect(() => highlight("a = 1", "toml")).toThrow(/does not know the language "toml"/);

    const [line] = highlight('name = "svjeez"', "toml", { grammars: [toml] });

    expect(line).toContainEqual(["string", '"svjeez"']);
  });
});
