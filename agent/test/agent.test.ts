import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { Miniflare, type MiniflareOptions, type RequestInit } from "miniflare";

import { bundle } from "../scripts/build.ts";
import { LIMITS } from "../src/limits";

const ROOT = join(import.meta.dir, "..");
const CODE = "let-me-in";

let agent: Miniflare;
let closed: Miniflare;

/** What the stubbed DeepSeek answers next, in order, and the requests it was sent. */
let answers: (Call | typeof LENGTH)[] = [];
let asked: { readonly messages: { readonly role: string; readonly content: unknown }[] }[] = [];

interface Reply {
  readonly content?: string;
  readonly tool_calls?: readonly {
    readonly id: string;
    readonly type: "function";
    readonly function: { readonly name: string; readonly arguments: string };
  }[];
}

const completion = (message: Reply, finish: string) =>
  Response.json({
    id: "test",
    object: "chat.completion",
    created: 0,
    model: "deepseek-flash",
    choices: [
      { index: 0, message: { role: "assistant", content: "", ...message }, finish_reason: finish },
    ],
    usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
  });

/** A model answer that calls one tool. */
interface Call {
  readonly tool: string;
  readonly input: Readonly<Record<string, string>>;
}

/** A model answer cut off at its output limit. */
const LENGTH = "length";

const call = (tool: string, input: Call["input"]): Call => ({ tool, input });

const options: MiniflareOptions = {
  modules: [{ type: "ESModule", path: join(ROOT, "dist/worker.js") }],
  compatibilityDate: "2026-07-30",
  workerLoaders: { LOADER: {} },
  durableObjects: { SESSIONS: { className: "Session", useSQLite: true } },
};

beforeAll(async () => {
  await bundle(join(ROOT, "src/index.ts"), join(ROOT, "dist/worker.js"));

  agent = new Miniflare({
    ...options,
    bindings: {
      DEEPSEEK_API_KEY: "test",
      INVITE_CODES: `other, ${CODE}`,
      SESSION_SECRET: "secret",
    },
    outboundService: async (request: Request) => {
      asked.push(await request.json());

      const next = answers.shift();

      if (!next) return completion({ content: "I am done." }, "stop");

      if (next === LENGTH) return completion({ content: "" }, "length");

      const { tool, input } = next;

      return completion(
        {
          tool_calls: [
            {
              id: `call-${asked.length}`,
              type: "function",
              function: { name: tool, arguments: JSON.stringify(input) },
            },
          ],
        },
        "tool_calls",
      );
    },
  });

  closed = new Miniflare(options);
}, 60_000);

afterAll(() => Promise.all([agent.dispose(), closed.dispose()]));

beforeEach(() => {
  answers = [];
  asked = [];
});

const request = (path: string, init: RequestInit = {}) =>
  agent.dispatchFetch(`http://localhost${path}`, { redirect: "manual", ...init });

const form = (fields: Record<string, string>) => ({
  method: "POST",
  body: new URLSearchParams(fields),
});

/** The invitation cookie, from entering the code at the gate. */
const signIn = async () => {
  const response = await request("/gate", form({ code: CODE, next: "/" }));

  expect(response.status).toBe(303);

  return response.headers.get("set-cookie")!.split(";")[0]!;
};

let cookie = "";

const authed = (path: string, init: RequestInit = {}) =>
  request(path, { ...init, headers: { cookie, ...init.headers } });

/** Starts a session on `prompt` and waits for its turn; answers the id and the events. */
const start = async (prompt: string) => {
  const response = await authed("/new", form({ prompt }));

  expect(response.status).toBe(303);

  const id = response.headers.get("location")!.slice(3);

  return { id, events: await watch(id) };
};

const watch = async (id: string) =>
  (await (await authed(`/s/${id}/watch`)).text())
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line));

const say = async (id: string, text: string) => {
  const response = await authed(`/s/${id}/message`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });

  expect(response.status).toBe(202);

  return watch(id);
};

const scene = (fill: string) =>
  `import { enter, render } from "svjeez";\n\nexport default () =>\n  render({ width: 100, height: 100, duration: 2, title: "Dot" }, <circle cx={50} cy={50} r={20} fill="${fill}" animation={enter({ at: 0, over: 1 })} />);\n`;

const BROKEN =
  'import { render } from "svjeez";\n\nexport default function build() {\n  const x = ;\n}\n';

beforeAll(async () => {
  cookie = await signIn();
});

describe("the gate", () => {
  test("asks for a code before the agent runs, and carries the prompt through", async () => {
    const page = await request("/new", form({ prompt: "a red dot" }));

    expect(page.status).toBe(200);
    expect(await page.text()).toContain('name="prompt" value="a red dot"');

    const wrong = await request("/gate", form({ code: "nope", next: "/" }));

    expect(wrong.status).toBe(403);
    expect(await wrong.text()).toContain("That code is not one we know.");

    answers = [
      call("compile", { source: scene("red") }),
      call("finish", { summary: "A red dot." }),
    ];

    const right = await request("/gate", form({ code: CODE, next: "/", prompt: "a red dot" }));

    expect(right.status).toBe(303);
    expect(right.headers.get("location")).toMatch(/^\/s\/[0-9a-f-]{36}$/);
    expect(right.headers.get("set-cookie")).toContain("HttpOnly");
  });

  test("keeps the session's page and API behind the code", async () => {
    const id = crypto.randomUUID();

    expect((await request(`/s/${id}`)).headers.get("location")).toBe(`/gate?next=%2Fs%2F${id}`);
    expect((await request(`/s/${id}/state`)).status).toBe(401);
    expect((await request(`/s/${id}/message`, { method: "POST" })).status).toBe(401);
  });

  test("turns the agent off, never open, when the secrets are missing", async () => {
    const response = await closed.dispatchFetch("http://localhost/new", form({ prompt: "a dot" }));

    expect(response.status).toBe(501);
  });
});

describe("a session", () => {
  test("sends a compile error back to the model, and keeps the source that compiles", async () => {
    answers = [
      call("read", { path: "examples/toast.tsx" }),
      call("compile", { source: BROKEN }),
      call("compile", { source: scene("red") }),
      call("finish", { summary: "A red dot fades in." }),
    ];

    const { id, events } = await start("a red dot");

    expect(events.map((event) => event.text)).toEqual([
      "reading examples/toast.tsx",
      "compiled: syntax error on line 4",
      "compiled: ok, 1 KB",
      "A red dot fades in.",
    ]);

    // The third model call saw the error, placed on its line.
    expect(asked[2]!.messages.at(-1)).toMatchObject({ role: "tool" });
    expect(JSON.parse(String(asked[2]!.messages.at(-1)!.content))).toMatchObject({
      ok: false,
      kind: "syntax",
      line: 4,
      excerpt: expect.stringContaining(">    4 |   const x = ;"),
    });

    expect(await (await request(`/s/${id}.tsx`)).text()).toBe(scene("red"));
    expect(await (await authed(`/s/${id}/state`)).json()).toMatchObject({
      version: 1,
      calls: 4,
      tokens: { input: 40, output: 20 },
    });

    const svg = await request(`/s/${id}.svg`);

    expect(svg.headers.get("content-type")).toBe("image/svg+xml; charset=utf-8");
    expect(await svg.text()).toContain('fill="red"');
  });

  test("edits the current scene on a follow-up, and undo goes back to it", async () => {
    answers = [
      call("compile", { source: scene("red") }),
      call("finish", { summary: "A red dot." }),
    ];

    const { id } = await start("a red dot");
    const first = asked.length;

    answers = [
      call("compile", { source: scene("blue") }),
      call("finish", { summary: "Now blue." }),
    ];

    const events = await say(id, "make it blue");

    expect(events.at(-1)).toEqual({ type: "done", text: "Now blue.", version: 2 });

    // The model saw the conversation so far and the scene it changes.
    const sent = asked[first]!.messages.filter((message) => message.role !== "system");

    expect(sent.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
    expect(String(sent.at(-1)!.content)).toContain(scene("red"));
    expect(String(sent.at(-1)!.content)).toEndWith("Change it: make it blue");
    expect(await (await request(`/s/${id}.svg`)).text()).toContain('fill="blue"');

    const undo = await authed(`/s/${id}/undo`, { method: "POST" });

    expect(await undo.json()).toMatchObject({ version: 1 });
    expect(await (await request(`/s/${id}.svg`)).text()).toContain('fill="red"');
    expect((await authed(`/s/${id}/undo`, { method: "POST" })).status).toBe(400);
  });

  test("ends a runaway turn at the step limit, and says so", async () => {
    answers = Array.from({ length: LIMITS.steps + 5 }, () =>
      call("read", { path: "references/charts.md" }),
    );

    const { id, events } = await start("charts");

    expect(asked).toHaveLength(LIMITS.steps);
    expect(events.at(-1)!.text).toBe(
      `I stopped after ${LIMITS.steps} steps without finishing. The scene is unchanged. Send a message to continue.`,
    );
    expect((await request(`/s/${id}.svg`)).status).toBe(404);
  });

  test("says so when the model runs out of room mid-answer", async () => {
    answers = [LENGTH];

    const { events } = await start("everything");

    expect(events.at(-1)!.text).toStartWith(
      "The model ran out of room before it finished writing.",
    );
  });

  test("refuses to finish while the last compile failed", async () => {
    answers = [
      call("compile", { source: BROKEN }),
      call("finish", { summary: "Done!" }),
      call("compile", { source: scene("green") }),
      call("finish", { summary: "A green dot." }),
    ];

    const { events } = await start("a green dot");

    expect(events.at(-1)!.text).toBe("A green dot.");
    expect(JSON.parse(String(asked[2]!.messages.at(-1)!.content)).error).toContain(
      "The last compile failed.",
    );
  });

  test("serves no scene before one compiled", async () => {
    expect((await request(`/s/${crypto.randomUUID()}.svg`)).status).toBe(404);
  });
});
