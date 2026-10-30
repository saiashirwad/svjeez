import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type HotPayload } from "vite";
import { appConfig } from "../app/config.ts";

const scratch = mkdtempSync(join(import.meta.dirname, "../.scratch-"));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

// The scene sits outside the app's root, as a scene shared between projects would, so Vite watches it only through the plugin.
test("the dev server serves a scene and reloads it when the scene or a file it imports changes", async () => {
  const app = join(scratch, "app");
  mkdirSync(app);
  writeFileSync(join(app, "main.ts"), `export { default } from "../scene.tsx?svjeez";`);
  writeFileSync(join(scratch, "label.ts"), `export const label = "first";`);

  const scene = (size: number) =>
    `import { render } from "svjeez";
import { label } from "./label";
export default () => render({ width: ${size}, height: 100, duration: 1, title: label }, <text x="10" y="50">{label}</text>);`;

  writeFileSync(join(scratch, "scene.tsx"), scene(200));

  const server = await createServer({
    ...appConfig(app),
    server: { port: 0, fs: { allow: [join(import.meta.dirname, "../../..")] } },
  });

  const sent: HotPayload[] = [];
  const send = server.environments.client.hot.send.bind(server.environments.client.hot);
  server.environments.client.hot.send = (payload: HotPayload) => (
    sent.push(payload),
    send(payload)
  );
  await server.listen();
  const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");

  const load = async () => {
    const main = await (await fetch(`${origin}/main.ts`)).text();
    const module = await (await fetch(origin + /from "([^"]+[?&]svjeez)"/.exec(main)![1]!)).text();
    const src = /"src":\s*"([^"]+)"/.exec(module)![1]!;

    return { module, svg: await (await fetch(origin + src)).text() };
  };

  const change = async (file: string, text: string) => {
    sent.length = 0;
    writeFileSync(join(scratch, file), text);

    for (
      let i = 0;
      i < 100 &&
      !sent.some((payload) => payload.type === "full-reload" || payload.type === "update");
      i++
    )
      await Bun.sleep(50);
    expect(sent.map((payload) => payload.type)).toContainAnyValues(["full-reload", "update"]);
  };

  try {
    const first = await load();
    // The watcher takes a moment to pick up the files the plugin asked it to watch.
    await Bun.sleep(500);
    expect(first.module).toContain(`"title": "first"`);
    expect(first.svg).toContain(">first</text>");

    await change("label.ts", `export const label = "second";`);
    expect((await load()).svg).toContain(">second</text>");

    await change("scene.tsx", scene(300));
    expect((await load()).module).toContain(`"width": 300`);
  } finally {
    await server.close();
  }
}, 60_000);
