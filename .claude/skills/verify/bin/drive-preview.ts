// Drives the dev preview page the way a person does: watch it play, press pause,
// drag the scrubber to a time, and read the clock and error panel back.
// Run through `verify preview drive`, which sets the cwd to packages/svjeez:
// playwright-core is that package's dependency, not the root's.
import { createRequire } from "node:module";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { chromium }: typeof import("playwright-core") = await import(
  createRequire(join(process.cwd(), "package.json")).resolve("playwright-core")
);

const { values, positionals } = parseArgs({
  args: process.argv.slice(2),
  allowPositionals: true,
  options: { at: { type: "string" }, name: { type: "string", default: "preview" } },
});

const [url, evidence] = positionals;
if (!url || !evidence) throw new Error("usage: drive-preview.ts <url> <evidence-dir> [--at s] [--name label]");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 900, height: 700 } });
const shot = (label: string) => page.screenshot({ path: join(evidence, `${values.name}-${label}.png`) });

await page.goto(url);
await page.waitForFunction(
  () => document.querySelector("#stage svg") || document.querySelector("#error")?.textContent,
);

const error = (await page.locator("#error").textContent())?.trim() || null;
const clock = () => page.locator("#clock").textContent();
const result: Record<string, unknown> = { url, error };

if (error) {
  await shot("error");
} else {
  result.title = await page.locator("#stage svg title").first().textContent();
  result.duration = Number(await page.locator("#scrub").getAttribute("max"));
  const first = await clock();
  await page.waitForTimeout(400);
  result.playing = { before: first, after: await clock() };
  await shot("playing");

  await page.getByRole("button", { name: "pause" }).click();
  result.toggle = await page.locator("#toggle").textContent();

  if (values.at !== undefined) {
    await page.locator("#scrub").fill(values.at);
    result.scrubbedTo = await clock();
    await shot(`at-${values.at}s`);
  }
  await page.waitForTimeout(300);
  result.heldAfterPause = await clock();
}

await browser.close();
console.log(JSON.stringify(result, null, 2));
await Bun.write(join(evidence, `${values.name}.json`), JSON.stringify(result, null, 2));
