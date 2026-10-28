import { describe, expect, test } from "bun:test";
import { render } from "svjeez";
import { adaptive, code, defaultDark, systemDark, systemLight, tint } from "svjeez/extras";
import toml from "shiki/langs/toml.mjs";
import { highlight } from "../src/index.ts";

const flat = (lines: ReturnType<typeof highlight>) =>
  lines.map((line) => line.map((p) => (Array.isArray(p) ? p[1] : p)).join(""));

describe("highlight", () => {
  test("tags runs with roles and keeps plain text bare", () => {
    expect(highlight("const x = 1;", "ts")).toEqual([
      [["keyword", "const"], " x ", ["punct", "="], " ", ["number", "1"], ["punct", ";"]],
    ]);
  });

  test("returns one array per line and gives an empty line no pieces", () => {
    const lines = highlight("a\n\n// b\n", "ts");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toEqual([]);
    expect(lines[2]).toEqual([["comment", "// b"]]);
  });

  test("the pieces of a line spell the source line", () => {
    const source = 'export const f = async (a: string) => <A b="c">{a}</A>;';

    expect(flat(highlight(source, "tsx"))).toEqual([source]);
  });

  test("merges adjacent runs of one role", () => {
    const [line] = highlight("// one two three", "ts");

    expect(line).toEqual([["comment", "// one two three"]]);
  });

  test("expands tabs to the next tab stop", () => {
    expect(flat(highlight("\tx\ty", "js", { tabSize: 4 }))).toEqual(["    x   y"]);
    expect(flat(highlight("\tx", "js"))).toEqual(["  x"]);
  });

  test("accepts CRLF input", () => {
    expect(highlight("a\r\nb", "js")).toHaveLength(2);
  });

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

  test("a bad tab size throws", () => {
    expect(() => highlight("x", "js", { tabSize: 0 })).toThrow(/tabSize/);
  });
});

describe("with code()", () => {
  const source = 'const greeting = "hi";';

  test("colors come from the theme", () => {
    const keyword = code(highlight(source, "ts"), { theme: defaultDark }).words[0];

    expect(keyword?.color).toBe(tint(defaultDark, "keyword"));
  });

  test("an adaptive theme switches with the color scheme instead of baking in hex", () => {
    const { theme, css } = adaptive({ light: systemLight, dark: systemDark });

    const svg = render(
      { width: 400, height: 80, duration: 1, title: "Code", css },
      code(highlight(source, "ts"), { x: 10, y: 10, theme }).node,
    );

    expect(svg).toContain(`fill="${tint(theme, "keyword")}"`);
    expect(svg).toContain("prefers-color-scheme");
    expect(svg).not.toContain("#000004");
  });
});
