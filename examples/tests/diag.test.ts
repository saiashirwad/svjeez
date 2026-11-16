import { test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, firefox, webkit } from "playwright-core";

const svg = readFileSync(join(import.meta.dir, "..", "dist", "site/day-night.svg"), "utf8");

test("diagnostics", async () => {
  for (const [name, type] of Object.entries({ chromium, firefox, webkit })) {
    const browser = await type.launch();
    const page = await browser.newPage({ colorScheme: "light" });

    await page.setContent("<!doctype html><body style='margin:0'>" + svg + "</body>");

    const out = await page.evaluate(() => {
      const all = [...document.querySelectorAll("*")];
      const el = all[13]!;
      const night = document.querySelector(".night");
      const probe = (tag: string, prop: string, value: string, read: (e: SVGGraphicsElement) => number) => {
        const s = document.querySelector("svg")!;
        const e = document.createElementNS("http://www.w3.org/2000/svg", tag) as SVGGraphicsElement;

        e.setAttribute("fill", "red");
        s.appendChild(e);
        e.style.setProperty(prop, value);
        const result = read(e);

        e.remove();

        return result;
      };

      return JSON.stringify({
        dark: matchMedia("(prefers-color-scheme: dark)").matches,
        light: matchMedia("(prefers-color-scheme: light)").matches,
        el: el.outerHTML.slice(0, 200),
        cs: { display: getComputedStyle(el).display, animationName: getComputedStyle(el).animationName, r: getComputedStyle(el).r, opacity: getComputedStyle(el).opacity },
        nightDisplay: night ? getComputedStyle(night).display : null,
        anims: el.getAnimations().length,
        total: document.getAnimations().length,
        cssWidthRect: probe("rect", "width", "50px", (e) => e.getBBox().width),
        cssHeightRect: probe("rect", "height", "50px", (e) => e.getBBox().height),
        cssRCircle: probe("circle", "r", "20px", (e) => e.getBBox().width),
        cssD: probe("path", "d", "path('M0 0H30V30H0Z')", (e) => e.getBBox().width),
      });
    });

    console.log("DIAG " + name + " " + out);
    await browser.close();
  }
}, 120000);
