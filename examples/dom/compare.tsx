/** @jsxImportSource svjeez */
// Scratch: draws each piece as a static SVG next to Chromium's own screenshot of the HTML.
import { google } from "@svjeez/fonts";
import { Dom, snapshotter } from "@svjeez/dom";
import { render } from "svjeez";
import { chromium } from "playwright-core";
import { pieces } from "./ui.tsx";
import { tailwind } from "./tailwind.ts";

const out = process.argv[2]!;
const scheme = (process.argv[3] ?? "light") as "light" | "dark";
const geist = await google.family("Geist", [400, 500, 600]);

const html = {
  login: pieces.login(false),
  failed: pieces.login(true),
  loading: pieces.loading,
  buttons: pieces.buttons,
  pr: pieces.pr(false),
  merged: pieces.pr(true),
  alert: pieces.alert,
};

const css = await tailwind(Object.values(html));
const shot = await snapshotter({ css, fonts: [geist] });
const browser = await chromium.launch();

for (const [name, markup] of Object.entries(html)) {
  const snap = await shot.html(markup);

  const svg = render(
    { width: snap.width, height: snap.height, title: name, duration: 1 },
    <Dom snapshot={snap} />,
  );

  await Bun.write(`${out}/${name}.svg`, svg);
  await Bun.write(`${out}/${name}.json`, JSON.stringify(snap.root, null, 1));
  const page = await browser.newPage({ deviceScaleFactor: 2, colorScheme: scheme });
  await page.setContent(
    `<html class="${scheme}"><head><style>body{margin:0;padding:24px;display:flex;gap:24px;align-items:flex-start;background:${scheme === "dark" ? "#27272a" : "#f4f4f5"}}${geist.faces.map((f) => `@font-face{font-family:Geist;src:url(${f.href});font-weight:${f.weight}}`).join("")}${css}</style></head><body><div style="padding:16px;background:${scheme === "dark" ? "#09090b" : "white"};display:inline-block">${markup}</div><img style="background:${scheme === "dark" ? "#09090b" : "white"}" src="data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}"></body></html>`,
  );
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `${out}/${name}-${scheme}.png`, fullPage: true });
  await page.close();
}

await shot.close();

await browser.close();

console.log("done");
