// The landing page with the scene inlined, so the page's CSS can drive its keyframes from the scrollbar.
import { readFileSync, writeFileSync } from "node:fs";

const here = (path: string) => new URL(path, import.meta.url);
const svg = readFileSync(here("../dist/landing.svg"), "utf8").replace(/^<\?xml[^>]*>\s*/, "");
const page = readFileSync(here("index.html"), "utf8");
if (!page.includes("<!-- landing.svg -->")) throw new Error("site/index.html has no <!-- landing.svg --> marker.");
writeFileSync(here("public/index.html"), page.replace("<!-- landing.svg -->", () => svg));
