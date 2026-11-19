import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { chromium } from "playwright-core";
import { captureScript, compile } from "@svjeez/dom";
import { react } from "@svjeez/dom/react";
import { svelte } from "@svjeez/dom/svelte";
import * as vite from "@svjeez/dom/vite";

// The files the browser side is served from, resolved by path at runtime, must exist in the package.
for (const framework of [react, svelte]) {
  assert.ok(existsSync(framework.client), `${framework.name} client missing: ${framework.client}`);
  assert.match(framework.client, /\.js$/);
}

assert.ok(vite.runFilm instanceof Function);

assert.ok(vite.component instanceof Function);

// `captureScript` is `capture.toString()`: it must stand alone in a page, with no helpers from the compile step.
assert.match(captureScript, /^\(.*\)$/s);

assert.doesNotMatch(captureScript, /\b(?:import|require)\b\s*[("']/);

assert.doesNotMatch(captureScript, /\b_?_[a-zA-Z]+\$?\d*\(/, "a compile helper leaked in");

const browser = await chromium.launch();

try {
  const page = await browser.newPage();

  await page.setContent(
    `<div id="root" style="width:40px;height:20px;background:#3EE6D6">hi</div>`,
  );

  const snapshot = await page.evaluate(`(${captureScript})(document.getElementById("root"))`);

  assert.ok(snapshot instanceof Object);
  assert.ok(compile(snapshot), "a captured snapshot compiles");
  console.log("captureScript ran in Chromium and compiled");
} finally {
  await browser.close();
}

// The Bun entries import `bun`, so they are only checked where Bun is installed.
try {
  execFileSync("bun", ["--version"], { stdio: "ignore" });
  execFileSync("bun", ["-e", `await import("@svjeez/dom/bun")`], { stdio: "inherit" });
  console.log("@svjeez/dom/bun imports under Bun");
} catch {
  console.log("bun not found; skipped the Bun entry");
}
