import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { html } from "./dist-server/server.js";

const body = html();

assert.match(body, /sj-code/);

assert.match(body, /dot\.tsx/);

assert.match(body, /role="slider"[^>]*aria-valuenow="40"/);

assert.match(body, /data-kind="color"/);

const assets = readdirSync("dist/assets");
const worker = assets.find((name) => /^worker-.*\.js$/.test(name));

assert.ok(worker, `the compile worker is bundled: ${assets.join(", ")}`);

assert.match(readFileSync(`dist/assets/${worker}`, "utf8"), /sucrase|transform/);

console.log(`server-rendered the editor and bundled its worker (${worker})`);
