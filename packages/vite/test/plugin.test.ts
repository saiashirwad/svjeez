import { afterAll, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { build, createServer, type HotPayload } from "vite";
import { Group, scene } from "svjeez/scene";
import { jsx } from "svjeez/scene/jsx-runtime";
import { getScene } from "../src/scene.ts";
import { appConfig } from "./app/config.ts";

const scratch = mkdtempSync(join(import.meta.dirname, ".scratch-"));

afterAll(() => rmSync(scratch, { recursive: true, force: true }));

test("a build emits the scene and its posters, and the bundle holds only their URLs", async () => {
  const outDir = join(scratch, "dist");
  await build({ ...appConfig(), build: { outDir, emptyOutDir: true } });
  const files = readdirSync(join(outDir, "assets"));
  const svg = files.find((file) => /^hero-.*\.svg$/.test(file));
  const js = files.find((file) => file.endsWith(".js"));
  expect(svg).toBeDefined();
  expect(readFileSync(join(outDir, "assets", svg!), "utf8")).toStartWith("<svg");

  for (const scheme of ["light", "dark"]) {
    const poster = files.find(
      (file) => file.startsWith(`hero-${scheme}-`) && file.endsWith(".webp"),
    );

    expect(
      readFileSync(join(outDir, "assets", poster!))
        .subarray(8, 12)
        .toString(),
    ).toBe("WEBP");
  }

  const bundle = readFileSync(join(outDir, "assets", js!), "utf8");
  expect(bundle).toContain(`/assets/${svg}`);
  expect(bundle).not.toContain("@keyframes");
}, 120_000);

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
    server: { port: 0, fs: { allow: [join(import.meta.dirname, "../..")] } },
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

test("a scene model default export, under its file's @jsxImportSource, is served as its SVG", async () => {
  const dir = join(scratch, "model");
  mkdirSync(dir);
  writeFileSync(join(dir, "main.ts"), `export { default } from "./scene.tsx?svjeez";`);
  writeFileSync(
    join(dir, "scene.tsx"),
    `/** @jsxImportSource svjeez/scene */
import { Shape, circle, rect, scene } from "svjeez/scene";
export default scene({ size: [120, 80], duration: 1, title: "Model" }, () => (
  <>
    <Shape geometry={rect(120, 80)} fill="#101010" />
    <Shape geometry={circle(10)} at={[60, 40]} fill="#3EE6D6" />
  </>
));`,
  );

  const server = await createServer({
    ...appConfig(dir),
    server: { port: 0, fs: { allow: [join(import.meta.dirname, "../..")] } },
  });

  try {
    await server.listen();
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const main = await (await fetch(`${origin}/main.ts`)).text();
    const module = await (await fetch(origin + /from "([^"]+[?&]svjeez)"/.exec(main)![1]!)).text();
    expect(module).toContain(`"title": "Model"`);
    expect(module).toContain(`"width": 120`);
    const src = /"src":\s*"([^"]+)"/.exec(module)![1]!;
    expect(await (await fetch(origin + src)).text()).toContain('<circle cx="60" cy="40" r="10"');
  } finally {
    await server.close();
  }
}, 60_000);

test("getScene() takes a scene model, or a function that returns one", () => {
  const model = scene({ size: [30, 20], duration: 1, title: "Made" }, () => jsx(Group, {}));

  expect(getScene(model)).toMatchObject({ width: 30, height: 20, title: "Made" });
  expect(getScene(() => model).svg).toBe(getScene(model).svg);
});

test("a scene imports a CommonJS package when the server environment bundles everything", async () => {
  const dir = join(scratch, "bundled");
  mkdirSync(join(dir, "node_modules/cjs-label"), { recursive: true });
  writeFileSync(
    join(dir, "node_modules/cjs-label/package.json"),
    `{"name":"cjs-label","version":"1.0.0","main":"index.js"}`,
  );
  writeFileSync(
    join(dir, "node_modules/cjs-label/index.js"),
    `Object.defineProperty(exports, "__esModule", { value: true });\nexports.label = "cjs";`,
  );
  writeFileSync(join(dir, "main.ts"), `export { default } from "./scene.tsx?svjeez";`);
  writeFileSync(
    join(dir, "scene.tsx"),
    `import { render } from "svjeez";
import { label } from "cjs-label";
export default () => render({ width: 100, height: 100, duration: 1, title: label }, <text x="10" y="50">{label}</text>);`,
  );

  const config = appConfig(dir);

  const server = await createServer({
    ...config,
    ssr: { ...config.ssr, noExternal: true },
    server: { port: 0, fs: { allow: [join(import.meta.dirname, "../..")] } },
  });

  try {
    await server.listen();
    const origin = server.resolvedUrls!.local[0]!.replace(/\/$/, "");
    const main = await (await fetch(`${origin}/main.ts`)).text();
    const response = await fetch(origin + /from "([^"]+[?&]svjeez)"/.exec(main)![1]!);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain(`"title": "cjs"`);
  } finally {
    await server.close();
  }
}, 60_000);

test("getScene() names an svg with no viewBox", () => {
  expect(() => getScene("<svg></svg>")).toThrow("getScene() needs a scene whose svg has a viewBox");
});
