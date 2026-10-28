import { readdirSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const files = readdirSync("dist/assets");
const find = (pattern) => files.find((file) => pattern.test(file)) ?? assert.fail(`no file matches ${pattern} in ${files}`);
const svg = find(/^scene-.*\.svg$/);
assert.match(readFileSync(`dist/assets/${svg}`, "utf8"), /^<svg[^>]*>[\s\S]*@keyframes[\s\S]*Hello/);
for (const scheme of ["light", "dark"]) assert.equal(readFileSync(`dist/assets/${find(new RegExp(`^scene-${scheme}-.*\\.webp$`))}`).subarray(8, 12).toString(), "WEBP");
const bundle = readFileSync(`dist/assets/${find(/\.js$/)}`, "utf8");
assert.ok(bundle.includes(`/assets/${svg}`), "the bundle holds the SVG's URL");
assert.ok(!bundle.includes("@keyframes"), "the bundle holds no svjeez output");
console.log(`✓ built ${svg} and its posters`);
