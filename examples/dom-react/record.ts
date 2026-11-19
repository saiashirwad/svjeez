// bun run examples/dom-react/record.ts
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scene } from "svjeez";
import { openScene } from "svjeez/frames";
import { svg } from "svjeez/tools";
import indexHtml from "./index.html";
import { cached, compile, inlineAssets, openPage, record } from "@svjeez/dom";

const HERE = import.meta.dir;
const OUT = join(HERE, "../dist");

// Any edit to the app's source (components, styles, html) re-records.
const sourceHash = async () => {
  const hasher = new Bun.CryptoHasher("sha256");

  for (const name of (await readdir(HERE)).sort())
    if (/\.(tsx?|css|html)$/.test(name) && name !== "record.ts")
      hasher.update(name).update(await Bun.file(join(HERE, name)).bytes());

  return hasher.digest("hex");
};

const server = Bun.serve({ port: 0, development: false, routes: { "/": indexHtml } });

await mkdir(OUT, { recursive: true });

const { page, close } = await openPage({
  url: `http://localhost:${server.port}/`,
  viewport: { width: 760, height: 560 },
});

const errors: string[] = [];

page.on("pageerror", (error) => errors.push(error.message));

page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

await page.waitForSelector("#app");

await page.evaluate(() => document.fonts.ready);

const shot = async (name: string) =>
  writeFile(join(OUT, `dom-react-${name}.png`), await page.locator("#app").screenshot());

const settle = () => page.waitForTimeout(150);

const states = await cached(join(HERE, "states.json"), { sources: await sourceHash() }, () =>
  record(
    page,
    "#app",
    async (snap) => {
      await settle();
      await snap("start");
      await shot("start");

      await page.locator('[data-key="col-todo"] button').first().click();
      await settle();
      await snap("moved", { over: 0.7 });
      await shot("moved");

      await page.locator("input").pressSequentially("Write the docs", { delay: 15 });
      await page.getByRole("button", { name: "Add" }).click();
      await settle();
      await snap("added", { over: 0.7 });
      await shot("added");
    },
    { scheme: "both" },
  ),
);

await close();

// Fonts are bundled under hashed URLs, so fetch them from the still-running server.
const inlined = await inlineAssets(states);

await server.stop(true);

const full = compile(inlined);
const still = compile(inlined[0]!.snapshot);

const emit = (title: string, { element, size, duration }: typeof full) =>
  svg.emit(scene({ size, duration, title }, () => element));

const board = emit("Sprint board", full);

await writeFile(join(OUT, "dom-react.svg"), board);

await writeFile(join(OUT, "dom-react-still.svg"), emit("Sprint board, still", still));

console.log(
  `dom-react.svg: ${full.size.join("x")}, ${full.duration.toFixed(2)}s, ${full.diagnostics.length} diagnostics`,
);

for (const { path, what } of full.diagnostics) console.log(`  ${path}: ${what}`);

console.log(
  `dom-react-still.svg: ${still.duration.toFixed(2)}s, ${still.diagnostics.length} diagnostics`,
);

for (const { path, what } of still.diagnostics) console.log(`  ${path}: ${what}`);

// Render the SVG at the end of each state's rest, next to the Chromium shot.
const view = await openScene(board, { colorScheme: "light" });
let at = 0;

for (const [index, state] of inlined.entries()) {
  at += (index === 0 ? 0 : (state.over ?? 0.6)) + (state.hold ?? 0.8);
  await writeFile(join(OUT, `dom-react-svg-${state.name}.png`), await view.capture(at - 0.05));
}

await view.close();

// Open each SVG in Chromium: it must parse and log nothing.
const checker = await openPage({ url: "about:blank" });
const problems: string[] = [];

checker.page.on("pageerror", (error) => problems.push(error.message));

checker.page.on(
  "console",
  (message) => message.type() === "error" && problems.push(message.text()),
);

for (const name of ["dom-react.svg", "dom-react-still.svg"]) {
  const response = await checker.page.goto(`file://${join(OUT, name)}`);

  console.log(`${name}: opened (${response?.status() ?? "ok"}), ${problems.length} console errors`);
}

await checker.close();

if (errors.length > 0) console.log(`page errors:\n${errors.join("\n")}`);
