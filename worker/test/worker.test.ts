import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { defaults, fromEntries, jsonSchema, parse, text, type Json } from "svjeez/params";

import { fill, TRIES, Unfit } from "../src/ai";
import { draw, load, names, type Name } from "../src/scenes";

const ROOT = join(import.meta.dir, "..");

let worker: Miniflare;
let keyed: Miniflare;

/** An answer that makes the stubbed DeepSeek fail as a service. */
const DOWN = "down";

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

      const answer = answers.shift() ?? "";

      return answer === DOWN
        ? new Response("upstream exploded", { status: 500 })
        : completion(answer);
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
    const one = await (await get("/card.svg?tag=v9.9.9")).text();
    const list = await (await get("/card.svg?bullets=First&bullets=Second")).text();

    expect(one).toContain("v9.9.9");
    expect(list).toContain(">First<");
    expect(list).toContain(">Second<");
  });

  const queries: readonly [Name, string][] = [
    ["code", "language=python&title=hello.py&source=print(%22hello%22)"],
    [
      "terminal",
      `params=${encodeURIComponent(
        JSON.stringify({
          lines: [
            { kind: "command", text: "ls" },
            { kind: "output", text: "README.md" },
          ],
        }),
      )}`,
    ],
    [
      "diagram",
      `source=${encodeURIComponent("sequenceDiagram\n  Alice->>Bob: Hello\n  Bob-->>Alice: Hi")}`,
    ],
    [
      "sequence",
      `params=${encodeURIComponent(
        JSON.stringify({
          actors: [
            { id: "app", label: "App", role: "task" },
            { id: "db", label: "Postgres", role: "store" },
          ],
          messages: [
            { from: "app", to: "db", text: "select", reply: "no" },
            { from: "db", to: "app", text: "rows", reply: "yes" },
          ],
        }),
      )}`,
    ],
    [
      "chart",
      `params=${encodeURIComponent(
        JSON.stringify({
          kind: "line",
          compare: "",
          data: [
            { label: "Mon", value: 3, other: 0 },
            { label: "Tue", value: 5, other: 0 },
          ],
        }),
      )}`,
    ],
    [
      "card",
      "tag=NEW&title=Dark%20mode&bullets=Follows%20the%20system&bullets=Every%20chart%20adapts",
    ],
    [
      "list",
      `params=${encodeURIComponent(
        JSON.stringify({
          rows: [
            { name: "esbuild", score: 1 },
            { name: "webpack", score: 61 },
          ],
        }),
      )}`,
    ],
    [
      "metrics",
      `params=${encodeURIComponent(
        JSON.stringify({
          kpis: [{ label: "Signups", value: 940, unit: "" }],
          weeks: [
            { label: "D1", value: 940 },
            { label: "D7", value: 610 },
          ],
        }),
      )}`,
    ],
    ["math", "title=Pythagoras&steps=a%5E2%20%2B%20b%5E2%20%3D%20c%5E2&steps=c%20%3D%205"],
    ["plot", "kind=function&expression=sin(x)%2Fx&y=&tex=y%20%3D%20%5Csin%20x%20%2F%20x"],
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
    const scene = await load("diagram");
    const response = await get(`/diagram.svg?source=${encodeURIComponent(MERMAID_ERROR)}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(failure(() => draw(scene, { source: MERMAID_ERROR })));
  });

  test("a bad expression is a 400 that says what is wrong", async () => {
    const response = await get("/plot.svg?kind=function&expression=foo(x)&y=");

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      'expression "foo(x)" cannot be evaluated: Undefined function foo',
    );
  });

  test("the index puts the build on every thumbnail, and ?v= alone renders the defaults", async () => {
    const html = await (await get("/")).text();
    const srcs = [...html.matchAll(/class="thumb" src="([^"]+)"/g)].map(([, src]) => src ?? "");

    expect(srcs.length).toBeGreaterThan(0);

    for (const src of srcs)
      expect(new URL(src, "http://localhost").searchParams.get("v")).toBeTruthy();

    expect(await (await get("/card.svg?v=anything")).text()).toBe((await load("card")).default());
  });

  test("/generate redirects to the template's prompt URL", async () => {
    const response = await worker.dispatchFetch(
      "http://localhost/generate?template=diagram&prompt=a%20cat",
      {
        redirect: "manual",
      },
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/diagram.svg?prompt=a+cat");
  });

  test("a bad value is a 400 with parse's message", async () => {
    const { params } = await load("card");
    const tag = "9".repeat(20);
    const response = await get(`/card.svg?tag=${tag}`);

    expect(response.status).toBe(400);
    expect(await response.text()).toBe(
      `These values do not fit the card template: ${failure(() => parse(params, { tag }))} Fix the value in the URL; /card.json lists what each param takes.`,
    );
  });

  test("/<name>.json is the schema and the defaults", async () => {
    const { params } = await load("card");

    expect(await (await get("/card.json")).json()).toEqual({
      params: jsonSchema(params),
      defaults: defaults(params),
    });
  });

  test("?prompt= without a key is a 501", async () => {
    expect((await get("/card.svg?prompt=a%20launch")).status).toBe(501);
  });

  test("?prompt= fills the params through the model, asking once more after a bad answer", async () => {
    const rest = { title: "A major release", bullets: ["Faster"] };

    answers.push(
      JSON.stringify({ tag: "far too long a tag here", ...rest }),
      JSON.stringify({ tag: "v2.0.0", ...rest }),
    );

    const response = await keyed.dispatchFetch(
      "http://localhost/card.svg?prompt=a%20major%20release",
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("v2.0.0");
    expect(answers).toHaveLength(0);
  }, 60_000);

  test("?prompt= sends a Mermaid syntax error back to the model, and renders its second answer", async () => {
    const scene = await load("diagram");
    const fixed = "flowchart LR\n  a --> b";

    asked.length = 0;
    answers.push(JSON.stringify({ source: MERMAID_ERROR }), JSON.stringify({ source: fixed }));

    const response = await keyed.dispatchFetch("http://localhost/diagram.svg?prompt=two%20boxes");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(draw(scene, { source: fixed }));
    expect(asked[1]?.at(-1)?.content).toStartWith(
      failure(() => draw(scene, { source: MERMAID_ERROR })),
    );
  }, 60_000);

  test("?prompt= is a 502 that tells the person what happened when every answer is bad", async () => {
    const { params } = await load("card");
    const answer = { tag: "far too long a tag here", title: "Again", bullets: ["One"] };

    answers.push(...Array.from({ length: TRIES }, () => JSON.stringify(answer)));
    const response = await keyed.dispatchFetch("http://localhost/card.svg?prompt=again");

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(
      `The model's answer did not fit the card template after ${TRIES} tries: ${failure(() => parse(params, answer))} Try asking for something shorter or simpler, or pick another template.`,
    );
  });

  test("?prompt= is a 502 that says the model could not be reached when it fails as a service", async () => {
    answers.length = 0;
    answers.push(DOWN, DOWN, DOWN);
    const response = await keyed.dispatchFetch("http://localhost/card.svg?prompt=down");
    const text = await response.text();

    answers.length = 0;
    expect(response.status).toBe(502);
    expect(text).toBe(
      "The model could not be reached, or did not answer in time. Try again in a minute.",
    );
  }, 60_000);

  test("a prompt over 600 characters is a 400", async () => {
    const prompt = "a".repeat(601);

    expect((await keyed.dispatchFetch(`http://localhost/card.svg?prompt=${prompt}`)).status).toBe(
      400,
    );
  });

  test("an unknown page is a 404 naming the scenes", async () => {
    const response = await get("/nope.svg");

    expect(response.status).toBe(404);
    expect(await response.text()).toContain("diagram");
  });

  test("the index shows every scene", async () => {
    const html = await (await get("/")).text();

    for (const name of names) expect(html).toContain(`src="/${name}.svg?v=`);
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

  test("an answer that leaves a param out is sent back, naming it", async () => {
    const sent: { readonly role: string; readonly content: string }[][] = [];
    const replies = ["{}", '{"version": "2.0.0"}'];

    const fetch = stub((body) => {
      sent.push(JSON.parse(body).messages);

      return replies[sent.length - 1]!;
    });

    await fill(schema, "a major release", accept, { key: "test", fetch });

    expect(sent[1]?.at(-1)?.content).toStartWith(
      "Write every param yourself. These are missing: version.",
    );
  });

  test("every answer bad throws Unfit with parse's message", async () => {
    const fetch = stub(() => '{"version": "far too long"}');

    const failed = fill(schema, "x", accept, { key: "test", fetch });

    await expect(failed).rejects.toBeInstanceOf(Unfit);
    await expect(failed).rejects.toThrow(failure(() => parse(schema, { version: "far too long" })));
  });
});
