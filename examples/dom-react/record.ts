// bun run examples/dom-react/record.ts
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { scene } from "svjeez";
import { openScene } from "svjeez/frames";
import { svg } from "svjeez/tools";
import { cached, compile, inlineAssets, openPage, record } from "@svjeez/dom";

const HERE = import.meta.dir;
const OUT = join(HERE, "../dist");
const FONTS = join(HERE, "../../packages/svjeez/tests/fixtures");

const built = await Bun.build({
  entrypoints: [join(HERE, "client.tsx")],
  target: "browser",
  minify: false,
});

if (!built.success) throw new Error(built.logs.join("\n"));

const js = await built.outputs[0]!.text();

const FILES = new Map([
  ["/body.ttf", "ABeeZee-Regular.ttf"],
  ["/display.ttf", "ArchivoBlack-Regular.ttf"],
]);

const server = Bun.serve({
  port: 0,
  fetch: ({ url }) => {
    const { pathname } = new URL(url);

    if (pathname === "/app.js")
      return new Response(js, { headers: { "content-type": "text/javascript" } });

    const font = FILES.get(pathname);

    if (font) return new Response(Bun.file(join(FONTS, font)));

    return new Response(
      '<!doctype html><meta charset="utf-8"><script type="module" src="/app.js"></script>',
      {
        headers: { "content-type": "text/html" },
      },
    );
  },
});

await mkdir(OUT, { recursive: true });

const { page, close } = await openPage({
  url: `http://localhost:${server.port}/`,
  viewport: { width: 760, height: 560 },
});

const errors: string[] = [];

page.on("pageerror", (error) => errors.push(error.message));

page.on("console", (message) => message.type() === "error" && errors.push(message.text()));

await page.evaluate(() => document.fonts.ready);

const shot = async (name: string) =>
  writeFile(join(OUT, `dom-react-${name}.png`), await page.locator("#app").screenshot());

const settle = () => page.waitForTimeout(150);

const states = await cached(
  join(HERE, "states.json"),
  { app: js, fonts: "ABeeZee+ArchivoBlack" },
  () =>
    record(
      page,
      "#app",
      async (snap) => {
        await settle();
        await snap("start");
        await shot("start");

        await page.locator(".col:not(.done) .card button").first().click();
        await settle();
        await snap("moved", { over: 0.7 });
        await shot("moved");

        await page.locator("input").pressSequentially("Write the docs", { delay: 15 });
        await page.locator(".add button").click();
        await settle();
        await snap("added", { over: 0.7 });
        await shot("added");
      },
      { scheme: "both" },
    ),
);

await close();

await server.stop(true);

const inlined = await inlineAssets(states, {
  // The page's port changes every run, so read its fonts from disk instead of the dead server.
  fetch: async (url) => new Response(Bun.file(join(FONTS, FILES.get(new URL(url).pathname)!))),
});

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
