import assert from "node:assert/strict";
import { tex } from "@svjeez/math";
import { render } from "svjeez";
import { morph } from "svjeez/extras";

const at = { x: 20, y: 20, fontSize: 40 };
const square = tex(String.raw`(a+b)^2`, at);
const expanded = tex(String.raw`a^2 + \cssId{mid}{2ab} + b^2`, at);

const svg = render({ width: 400, height: 120, duration: 4, title: "Math" }, [
  morph([square, expanded], { at: [1], over: 1 }).node,
]);

assert.match(svg, /^<svg[\s\S]*@keyframes[\s\S]*<path d="M/);

assert.equal(expanded.words[0].text, "a@1");

assert.ok(expanded.get("mid").w > 0);

assert.throws(() => tex(String.raw`\frac{`), /could not parse/);

console.log(`rendered an equation morph into ${(svg.length / 1024).toFixed(1)} KB`);
