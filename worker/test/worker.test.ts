import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { defaults, jsonSchema, parse, text } from "svjeez/params";

import { fill } from "../src/ai";
import { load, names } from "../src/scenes";

const ROOT = join(import.meta.dir, "..");

let worker: Miniflare;
let keyed: Miniflare;

/** What the stubbed DeepSeek answers next, in order. */
const answers: string[] = [];

const completion = (content: string) =>
  Response.json({
    id: "test",
    object: "chat.completion",
    created: 0,
    model: "deepseek-v4-flash",
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

beforeAll(() => {
  const build = Bun.spawnSync([process.execPath, "scripts/build.ts"], {
    cwd: ROOT,
    stderr: "pipe",
  });

  if (build.exitCode !== 0) throw new Error(build.stderr.toString());

  const options = {
    modules: [{ type: "ESModule" as const, path: join(ROOT, "dist/worker.js") }],
    compatibilityDate: "2026-07-30",
  };

  worker = new Miniflare(options);

  keyed = new Miniflare({
    ...options,
    bindings: { DEEPSEEK_API_KEY: "test" },
    outboundService: (request: Request) =>
      new URL(request.url).hostname === "api.deepseek.com"
        ? completion(answers.shift() ?? "")
        : fetch(request.url, { headers: Object.fromEntries(request.headers) }),
  });
});

afterAll(() => Promise.all([worker.dispose(), keyed.dispose()]));

const failure = (run: () => void): string => {
  try {
    run();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error("Expected it to throw.");
};

const get = (path: string) => worker.dispatchFetch(`http://localhost${path}`);

describe("in workerd", () => {
  for (const name of names)
    test(`${name} renders what build() returns`, async () => {
      const response = await get(`/${name}.svg`);
      const svg = await response.text();

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
      expect(response.headers.get("cache-control")).toBe("public, max-age=3600");
      expect(svg).toContain("<svg");
      expect(svg).toBe((await load(name)).default());
    }, 60_000);

  test("a query sets params", async () => {
    const one = await (await get("/release-card.svg?version=9.9.9")).text();
    const list = await (await get("/release-card.svg?highlights=First&highlights=Second")).text();

    expect(one).toContain("v9.9.9");
    expect(list).toContain(">First<");
    expect(list).toContain(">Second<");
  });

  test("a bad value is a 400 with parse's message", async () => {
    const { params } = await load("release-card");
    const version = "9".repeat(20);
    const response = await get(`/release-card.svg?version=${version}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(failure(() => parse(params!, { version })));
  });

  test("/<name>.json is the schema and the defaults", async () => {
    const { params } = await load("release-card");

    expect(await (await get("/release-card.json")).json()).toEqual({
      params: jsonSchema(params!),
      defaults: defaults(params!),
    });
  });

  test("?prompt= without a key is a 501", async () => {
    expect((await get("/release-card.svg?prompt=a%20launch")).status).toBe(501);
  });

  test("?prompt= fills the params through the model, asking once more after a bad answer", async () => {
    answers.push('{"version": "far too long a version"}', '{"version": "2.0.0"}');

    const response = await keyed.dispatchFetch(
      "http://localhost/release-card.svg?prompt=a%20major%20release",
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("v2.0.0");
    expect(answers).toHaveLength(0);
  }, 60_000);

  test("?prompt= is a 502 with parse's message when the second answer is bad too", async () => {
    const { params } = await load("release-card");
    const version = "far too long a version";

    answers.push(JSON.stringify({ version }), JSON.stringify({ version }));
    const response = await keyed.dispatchFetch("http://localhost/release-card.svg?prompt=again");

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(failure(() => parse(params!, { version })));
  });

  test("a prompt over 300 characters is a 400", async () => {
    const prompt = "a".repeat(301);

    expect(
      (await keyed.dispatchFetch(`http://localhost/release-card.svg?prompt=${prompt}`)).status,
    ).toBe(400);
  });

  test("an unknown page is a 404 naming the scenes", async () => {
    const response = await get("/nope.svg");

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("release-card");
  });

  test("the index shows every scene", async () => {
    const html = await (await get("/")).text();

    for (const name of names) expect(html).toContain(`src="/${name}.svg"`);
  }, 60_000);
});

describe("fill", () => {
  const schema = { version: text("0.1.0", { maxLength: 8 }) };

  const stub = (answer: (body: string) => string): typeof fetch =>
    Object.assign(
      async (_url: RequestInfo | URL, init?: RequestInit) => completion(answer(String(init?.body))),
      { preconnect: fetch.preconnect },
    );

  test("asks again once with parse's message, then returns the values", async () => {
    const asked: { readonly role: string; readonly content: string }[][] = [];
    const replies = ['{"version": "far too long"}', '{"version": "2.0.0"}'];

    const fetch = stub((body) => {
      asked.push(JSON.parse(body).messages);

      return replies[asked.length - 1]!;
    });

    expect(await fill(schema, "a major release", { key: "test", fetch })).toEqual({
      version: "2.0.0",
    });
    expect(asked).toHaveLength(2);
    expect(asked[0]?.[0]?.content).toContain('"maxLength":8');
    expect(asked[1]?.at(-2)?.content).toBe('{"version": "far too long"}');
    expect(asked[1]?.at(-1)?.content).toStartWith(
      failure(() => parse(schema, { version: "far too long" })),
    );
  });

  test("a second bad answer throws parse's message", async () => {
    const fetch = stub(() => '{"version": "far too long"}');

    await expect(fill(schema, "x", { key: "test", fetch })).rejects.toThrow(
      failure(() => parse(schema, { version: "far too long" })),
    );
  });
});
