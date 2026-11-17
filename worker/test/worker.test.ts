import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { defaults, fromEntries, jsonSchema, parse, text, type Json } from "svjeez/params";

import { fill } from "../src/ai";
import { draw, load, names, type Name } from "../src/scenes";

const ROOT = join(import.meta.dir, "..");

let worker: Miniflare;
let keyed: Miniflare;

/** What the stubbed DeepSeek answers next, in order, and the messages it was sent. */
const answers: string[] = [];
const asked: { readonly role: string; readonly content: string }[][] = [];

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
    outboundService: async (request: Request) => {
      if (new URL(request.url).hostname !== "api.deepseek.com")
        return fetch(request.url, { headers: Object.fromEntries(request.headers) });

      asked.push((await request.json()).messages);

      return completion(answers.shift() ?? "");
    },
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

const MERMAID_ERROR = "flowchart LR\n  a --> b\n  classDef red fill:#f00";

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

  const queries: readonly [Name, string][] = [
    ["charts", "headline=Rainfall%20doubled&mark=0&area=3&area=5&area=9"],
    [
      "flowchart",
      `params=${encodeURIComponent(
        JSON.stringify({
          direction: "TB",
          nodes: [
            { id: "a", label: "Order placed", role: "input", group: "" },
            { id: "b", label: "In stock?", role: "decision", group: "" },
            { id: "c", label: "Ship it", role: "output", group: "" },
          ],
          groups: [],
          edges: [
            { from: "a", to: "b", label: "" },
            { from: "b", to: "c", label: "yes" },
          ],
          from: "a",
          to: "c",
        }),
      )}`,
    ],
    [
      "sequence",
      `params=${encodeURIComponent(
        JSON.stringify({
          actors: [
            { id: "c", label: "Client", role: "input" },
            { id: "s", label: "Server", role: "task" },
          ],
          messages: [
            { from: "c", to: "s", text: "GET /", reply: "no" },
            { from: "s", to: "c", text: "200", reply: "yes" },
          ],
        }),
      )}`,
    ],
    [
      "state",
      `params=${encodeURIComponent(
        JSON.stringify({
          states: [
            { id: "off", label: "Off", role: "task", final: "no", parent: "" },
            { id: "on", label: "On", role: "output", final: "no", parent: "" },
          ],
          transitions: [
            { from: "off", to: "on", label: "press" },
            { from: "on", to: "off", label: "press" },
          ],
          walk: ["off", "on", "off"],
        }),
      )}`,
    ],
    [
      "mermaid",
      `source=${encodeURIComponent("sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi")}`,
    ],
    [
      "code",
      `params=${encodeURIComponent(JSON.stringify({ versions: [{ label: "Py", language: "python", source: 'print("hello")' }] }))}`,
    ],
    [
      "terminal",
      `params=${encodeURIComponent(
        JSON.stringify({
          lines: [
            { kind: "command", text: "ls" },
            { kind: "output", text: "{blue README.md}" },
          ],
        }),
      )}`,
    ],
    ["math", "before=x%5E2&after=%5CcssId%7Bcross%7D%7Bx%7Dx&curve=0&curve=0&curve=1"],
    ["icons", "outlines=star&outlines=brand-github&pop=star-filled&popLabel=Star"],
  ];

  for (const [name, query] of queries)
    test(`/${name}.svg?${query.slice(0, 24)}… renders what build() returns for it`, async () => {
      const search = new URLSearchParams(query);
      const scene = await load(name);
      const json: Json = search.get("params") ?? fromEntries(scene.params, search);
      const response = await get(`/${name}.svg?${query}`);

      expect(response.status).toBe(200);
      expect(await response.text()).toBe(draw(scene, json));
    });

  test("a Mermaid syntax error in the query is a 400 with the parser's message", async () => {
    const scene = await load("mermaid");
    const response = await get(`/mermaid.svg?source=${encodeURIComponent(MERMAID_ERROR)}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(failure(() => draw(scene, { source: MERMAID_ERROR })));
  });

  test("/generate redirects to the template's prompt URL", async () => {
    const response = await worker.dispatchFetch(
      "http://localhost/generate?template=mermaid&prompt=a%20cat",
      {
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/mermaid.svg?prompt=a+cat");
  });

  test("a bad value is a 400 with parse's message", async () => {
    const { params } = await load("release-card");
    const version = "9".repeat(20);
    const response = await get(`/release-card.svg?version=${version}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(failure(() => parse(params, { version })));
  });

  test("/<name>.json is the schema and the defaults", async () => {
    const { params } = await load("release-card");

    expect(await (await get("/release-card.json")).json()).toEqual({
      params: jsonSchema(params),
      defaults: defaults(params),
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

  test("?prompt= sends a Mermaid syntax error back to the model, and renders its second answer", async () => {
    const scene = await load("mermaid");
    const fixed = "flowchart LR\n  a --> b";

    asked.length = 0;
    answers.push(JSON.stringify({ source: MERMAID_ERROR }), JSON.stringify({ source: fixed }));

    const response = await keyed.dispatchFetch("http://localhost/mermaid.svg?prompt=two%20boxes");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(draw(scene, { source: fixed }));
    expect(asked[1]?.at(-1)?.content).toStartWith(
      failure(() => draw(scene, { source: MERMAID_ERROR })),
    );
  }, 60_000);

  test("?prompt= is a 502 with parse's message when the second answer is bad too", async () => {
    const { params } = await load("release-card");
    const version = "far too long a version";

    answers.push(JSON.stringify({ version }), JSON.stringify({ version }));
    const response = await keyed.dispatchFetch("http://localhost/release-card.svg?prompt=again");

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(failure(() => parse(params, { version })));
  });

  test("a prompt over 600 characters is a 400", async () => {
    const prompt = "a".repeat(601);

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
  const accept = (json: Json) => parse(schema, json);

  const stub = (answer: (body: string) => string): typeof fetch =>
    Object.assign(
      async (_url: RequestInfo | URL, init?: RequestInit) => completion(answer(String(init?.body))),
      { preconnect: fetch.preconnect },
    );

  test("asks again once with parse's message, then returns the values", async () => {
    const sent: { readonly role: string; readonly content: string }[][] = [];
    const replies = ['{"version": "far too long"}', '{"version": "2.0.0"}'];

    const fetch = stub((body) => {
      sent.push(JSON.parse(body).messages);

      return replies[sent.length - 1]!;
    });

    expect(await fill(schema, "a major release", accept, { key: "test", fetch })).toEqual({
      version: "2.0.0",
    });
    expect(sent).toHaveLength(2);
    expect(sent[0]?.[0]?.content).toContain('"maxLength":8');
    expect(sent[1]?.at(-2)?.content).toBe('{"version": "far too long"}');
    expect(sent[1]?.at(-1)?.content).toStartWith(
      failure(() => parse(schema, { version: "far too long" })),
    );
  });

  test("a second bad answer throws parse's message", async () => {
    const fetch = stub(() => '{"version": "far too long"}');

    await expect(fill(schema, "x", accept, { key: "test", fetch })).rejects.toThrow(
      failure(() => parse(schema, { version: "far too long" })),
    );
  });
});
