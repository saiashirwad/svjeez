import { existsSync, readFileSync } from "node:fs";
import assert from "node:assert/strict";

const html = readFileSync("dist/index.html", "utf8");
const src = (id) => new RegExp(`<img[^>]*id="${id}"[^>]*>`).exec(html)?.[0].match(/src="([^"]+)"/)?.[1] ?? assert.fail(`no <img id="${id}"> in ${html}`);
const scene = src("scene");
assert.match(scene, /^\/_svjeez\/.+\.svg$/);
assert.match(readFileSync(`dist${scene}`, "utf8"), /^<svg[^>]*>[\s\S]*Hello/);
assert.equal(readFileSync(`dist${src("poster")}`).subarray(8, 12).toString(), "WEBP");
assert.ok(existsSync(`dist${src("imported")}`), "the ?svjeez import's file is in the build");
console.log(`✓ built ${scene}, its poster, and the ?svjeez import`);
