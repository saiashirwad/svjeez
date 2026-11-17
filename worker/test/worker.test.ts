import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Miniflare } from "miniflare";
import { defaults, fromEntries, jsonSchema, parse, text, type Json } from "svjeez/params";

import { fill, TRIES, Unfit } from "../src/ai";
import type { Deck } from "../src/document";
import { renderDeck } from "../src/slides";
import { draw, load, names, type Name } from "../src/scenes";

const ROOT = join(import.meta.dir, "..");

let worker: Miniflare;
let keyed: Miniflare;

/** An answer that makes the stubbed DeepSeek fail as a service. */
const DOWN = "down";

/** A model answer that calls tools instead of writing text. */
interface Calls {
  readonly calls: readonly { readonly name: string; readonly args: Json }[];
}

/** What the stubbed DeepSeek answers next, in order, and the messages it was sent. */
const answers: (string | Calls)[] = [];
const asked: { readonly role: string; readonly content: string }[][] = [];

const isCalls = (answer: string | Calls): answer is Calls => typeof answer !== "string";

const completion = (answer: string | Calls) =>
  Response.json({
    id: "test",
    object: "chat.completion",
    created: 0,
    model: "deepseek-v4-flash",
    choices: [
      !isCalls(answer)
        ? { index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }
        : {
            index: 0,
            message: {
              role: "assistant",
              content: null,
              reasoning_content: "",
              tool_calls: answer.calls.map(({ name, args }, i) => ({
                id: `call_${asked.length}_${i}`,
                type: "function",
                function: { name, arguments: JSON.stringify(args) },
              })),
            },
            finish_reason: "tool_calls",
          },
    ],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });

/** The invitation cookie the keyed Worker sets for a known code. */
let cookie = "";

beforeAll(async () => {
  const build = Bun.spawnSync([process.execPath, "scripts/build.ts"], {
    cwd: ROOT,
    stderr: "pipe",
  });

  if (build.exitCode !== 0) throw new Error(build.stderr.toString());

  const options = {
    modules: [{ type: "ESModule" as const, path: join(ROOT, "dist/worker.js") }],
    compatibilityDate: "2026-07-30",
    durableObjects: { SESSIONS: { className: "Session", useSQLite: true } },
  };

  worker = new Miniflare(options);

  keyed = new Miniflare({
    ...options,
    bindings: {
      DEEPSEEK_API_KEY: "test",
      INVITE_CODES: "alpha, beta",
      SESSION_SECRET: "test-secret",
    },
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

  const entered = await keyed.dispatchFetch("http://localhost/gate", {
    method: "POST",
    body: new URLSearchParams({ code: "beta", next: "/" }),
    redirect: "manual",
  });

  cookie = (entered.headers.get("set-cookie") ?? "").split(";")[0] ?? "";
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

/** A request to the keyed Worker carrying the invitation cookie. */
const invited = (
  path: string,
  init: {
    readonly method?: string;
    readonly body?: string;
    readonly headers?: Record<string, string>;
  } = {},
) =>
  keyed.dispatchFetch(`http://localhost${path}`, {
    ...init,
    headers: { ...init.headers, cookie },
    redirect: "manual",
  });

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
    [
      "deck",
      `params=${encodeURIComponent(
        JSON.stringify({
          slides: [
            { kind: "title", heading: "Hello", body: "A two-slide deck", language: "typescript" },
            { kind: "bullets", heading: "Points", body: "One\nTwo", language: "typescript" },
          ],
        }),
      )}`,
    ],
    [
      "map",
      `params=${encodeURIComponent(JSON.stringify({ title: "Two cities", measure: "", countries: [{ name: "France", value: 0 }], markers: [{ label: "Paris", lat: 48.86, lon: 2.35 }], routes: [] }))}`,
    ],
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

  test("a chart with a few long labels renders them under their bars", async () => {
    const data = ["JavaScript", "Rust", "C++"].map((label, i) => ({
      label,
      value: i + 1,
      other: 0,
    }));

    const scene = await load("chart");
    const json = { kind: "bar", compare: "", data };
    const response = await get(`/chart.svg?params=${encodeURIComponent(JSON.stringify(json))}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(draw(scene, json));
  });

  test("a chart whose labels cannot fit says how many characters fit for that many points", async () => {
    const data = Array.from({ length: 16 }, (_, i) => ({
      label: `Category ${i + 10}`,
      value: i,
      other: 0,
    }));

    const response = await get(
      `/chart.svg?params=${encodeURIComponent(JSON.stringify({ compare: "", data }))}`,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      'data labels must fit under their points: with 16 points about 6 characters fit, and "Category 10" has 11.',
    );
  });

  test("a malformed deck slide is a 400 that names the slide and the format", async () => {
    const slides = [
      { kind: "title", heading: "Bad", body: "", language: "typescript" },
      { kind: "chart", heading: "Broken", body: "Q1 is 42", language: "typescript" },
    ];

    const response = await get(
      `/deck.svg?params=${encodeURIComponent(JSON.stringify({ slides }))}`,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain(
      'Slide 2 (chart): line 1 "Q1 is 42" is not "label: value".',
    );
  });

  test("an unknown country is a 400 that suggests atlas names", async () => {
    const countries = [{ name: "Untied States", value: 0 }];

    const response = await get(
      `/map.svg?params=${encodeURIComponent(JSON.stringify({ countries }))}`,
    );

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('Did you mean "United States of America"?');
  });

  test("the index puts the build on every thumbnail, and ?v= alone renders the defaults", async () => {
    const html = await (await get("/")).text();
    const srcs = [...html.matchAll(/class="thumb" src="([^"]+)"/g)].map(([, src]) => src ?? "");

    expect(srcs.length).toBeGreaterThan(0);

    for (const src of srcs)
      expect(new URL(src, "http://localhost").searchParams.get("v")).toBeTruthy();

    expect(await (await get("/card.svg?v=anything")).text()).toBe((await load("card")).default());
  });

  test("/generate, with an invitation, redirects to the template's prompt URL", async () => {
    const response = await invited("/generate?template=diagram&prompt=a%20cat");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/diagram.svg?prompt=a+cat");
  });

  test("a bad value is a 400 with parse's message", async () => {
    const { params } = await load("card");
    const tag = "9".repeat(50);
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
      JSON.stringify({ tag: "a tag far too long to fit in the pill above it", ...rest }),
      JSON.stringify({ tag: "v2.0.0", ...rest }),
    );

    const response = await invited("/card.svg?prompt=a%20major%20release");

    expect(response.status).toBe(200);
    expect(await response.text()).toContain("v2.0.0");
    expect(answers).toHaveLength(0);
  }, 60_000);

  test("?prompt= sends a Mermaid syntax error back to the model, and renders its second answer", async () => {
    const scene = await load("diagram");
    const fixed = "flowchart LR\n  a --> b";

    asked.length = 0;
    answers.push(JSON.stringify({ source: MERMAID_ERROR }), JSON.stringify({ source: fixed }));

    const response = await invited("/diagram.svg?prompt=two%20boxes");

    expect(response.status).toBe(200);
    expect(await response.text()).toBe(draw(scene, { source: fixed }));
    expect(asked[1]?.at(-1)?.content).toStartWith(
      failure(() => draw(scene, { source: MERMAID_ERROR })),
    );
  }, 60_000);

  test("?prompt= is a 502 that tells the person what happened when every answer is bad", async () => {
    const { params } = await load("card");

    const answer = {
      tag: "a tag far too long to fit in the pill above it",
      title: "Again",
      bullets: ["One"],
    };

    answers.push(...Array.from({ length: TRIES }, () => JSON.stringify(answer)));
    const response = await invited("/card.svg?prompt=again");

    expect(response.status).toBe(502);
    expect(await response.text()).toBe(
      `The model's answer did not fit the card template after ${TRIES} tries: ${failure(() => parse(params, answer))} Try asking for something shorter or simpler, or pick another template.`,
    );
  });

  test("?prompt= is a 502 that says the model could not be reached when it fails as a service", async () => {
    answers.length = 0;
    answers.push(DOWN, DOWN, DOWN);
    const response = await invited("/card.svg?prompt=down");
    const text = await response.text();

    answers.length = 0;
    expect(response.status).toBe(502);
    expect(text).toBe(
      "The model could not be reached, or did not answer in time. Try again in a minute.",
    );
  }, 60_000);

  test("a prompt over 600 characters is a 400", async () => {
    const prompt = "a".repeat(601);

    expect((await invited(`/card.svg?prompt=${prompt}`)).status).toBe(400);
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

describe("sessions", () => {
  const add = (kind: string, values: Json) => ({
    calls: [{ name: "add_slide", args: { kind, values } }],
  });

  const MAP = {
    heading: "Where it happened",
    measure: "",
    countries: [{ name: "France", value: 0 }],
    markers: [{ label: "Paris", lat: 48.86, lon: 2.35 }],
    routes: [],
  };

  const TITLE = { heading: "A short history", subtitle: "Three slides" };
  const BULLETS = { heading: "What to know", bullets: ["One", "Two"] };

  /** A fresh session's id, through /new with the invitation cookie. */
  const fresh = async () => {
    const response = await invited("/new");

    expect(response.status).toBe(302);

    return (response.headers.get("location") ?? "").slice("/s/".length);
  };

  /** Sends a message and reads the turn's lines of progress to the end. */
  const say = async (id: string, text: string) => {
    const response = await invited(`/s/${id}/message`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });

    expect(response.status).toBe(200);

    // SAFETY: the session writes one JSON event per line.
    return (await response.text())
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line) as { type: string; text: string; version?: number });
  };

  // SAFETY: the state route answers with the session's state, whose deck and version these are.
  const state = async (id: string) =>
    (await (await invited(`/s/${id}/state`)).json()) as {
      deck: Deck;
      version: number;
    };

  test("a turn adds three slides, one of them a map, and its SVG is the stored deck rendered", async () => {
    const id = await fresh();

    answers.push(add("title", TITLE), add("bullets", BULLETS), add("map", MAP), {
      calls: [{ name: "finish", args: { summary: "Three slides are ready." } }],
    });

    const events = await say(id, "Three slides about Paris");

    expect(events.map((e) => e.text)).toEqual([
      "added slide 1: title",
      "added slide 2: bullets",
      "added slide 3: map",
      "Three slides are ready.",
    ]);

    const { deck } = await state(id);

    expect(deck.slides.map((slide) => slide.kind)).toEqual(["title", "bullets", "map"]);
    expect(await (await invited(`/s/${id}.svg`)).text()).toBe(renderDeck(deck));
  }, 60_000);

  test("a bad slide's error goes back to the model, and its second call fixes it", async () => {
    const id = await fresh();
    const wrong = { ...MAP, countries: [{ name: "Frnace", value: 0 }] };

    asked.length = 0;
    answers.push(add("map", wrong), add("map", MAP), {
      calls: [{ name: "finish", args: { summary: "Fixed." } }],
    });

    const events = await say(id, "A map of France");
    const reply = String(asked[1]?.at(-1)?.content);

    expect(reply).toContain('is not a country in the atlas. Did you mean \\"France\\"?');
    expect(events[0]?.text).toStartWith("Slide 1 (map): countries[0].name");
    expect(events.map((e) => e.text).slice(1)).toEqual(["added slide 1: map", "Fixed."]);
  }, 60_000);

  test("the step limit ends a runaway turn with a plain message", async () => {
    const id = await fresh();
    const outline = { calls: [{ name: "outline", args: {} }] };

    answers.push(...Array.from({ length: 40 }, () => outline));

    const events = await say(id, "Keep looking");

    expect(answers).toHaveLength(0);
    expect(events.at(-1)?.text).toBe(
      "I stopped after 40 steps without finishing. Send another message to continue.",
    );
  }, 60_000);

  test("undo goes back one accepted change", async () => {
    const id = await fresh();

    answers.push(add("title", TITLE), add("bullets", BULLETS), {
      calls: [{ name: "finish", args: { summary: "Two." } }],
    });

    await say(id, "Two slides");

    const before = await state(id);
    const undone = await invited(`/s/${id}/undo`, { method: "POST" });
    const after = await state(id);

    expect(undone.status).toBe(200);
    expect(before.deck.slides).toHaveLength(2);
    expect(after.deck.slides.map((slide) => slide.kind)).toEqual(["title"]);
    expect(after.version).toBeLessThan(before.version);
  }, 60_000);

  test("the gate turns away a missing or wrong code and lets a known one in", async () => {
    const page = await keyed.dispatchFetch("http://localhost/new", { redirect: "manual" });
    const id = crypto.randomUUID();

    const api = await keyed.dispatchFetch(`http://localhost/s/${id}/message`, {
      method: "POST",
      body: "{}",
    });

    const wrong = await keyed.dispatchFetch("http://localhost/gate", {
      method: "POST",
      body: new URLSearchParams({ code: "gamma", next: "/new" }),
      redirect: "manual",
    });

    const right = await keyed.dispatchFetch("http://localhost/gate", {
      method: "POST",
      body: new URLSearchParams({ code: "alpha", next: "/new" }),
      redirect: "manual",
    });

    expect(page.status).toBe(302);
    expect(page.headers.get("location")).toBe("/gate?next=%2Fnew");
    expect(api.status).toBe(401);
    expect(wrong.status).toBe(403);
    expect(right.status).toBe(303);
    expect(right.headers.get("location")).toBe("/new");
    expect(right.headers.get("set-cookie")).toContain("HttpOnly");
  });

  test("without the gate's secrets, gated routes answer 501 and never open", async () => {
    const response = await get("/new");

    expect(response.status).toBe(501);
  });
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
