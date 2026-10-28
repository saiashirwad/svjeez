import assert from "node:assert/strict";
import { highlight } from "@svjeez/code";
import { render } from "svjeez";
import { code, defaultDark, tint } from "svjeez/extras";

const tokens = highlight("const answer = 42;", "ts");

assert.deepEqual(tokens[0][0], ["keyword", "const"]);

const svg = render(
  { width: 400, height: 80, duration: 1, title: "Code" },
  code(tokens, { x: 10, y: 10, theme: defaultDark }).node,
);

assert.ok(svg.includes(`fill="${tint(defaultDark, "keyword")}"`));

assert.throws(() => highlight("x", "cobol"), /does not know the language "cobol"/);

console.log(`highlighted a line into ${(svg.length / 1024).toFixed(1)} KB of SVG`);
