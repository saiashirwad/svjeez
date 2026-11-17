import { Hono, type Context } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { defaults, fromEntries, jsonSchema } from "svjeez/params";

import type { WorkerEnv } from "../alchemy.run.ts";
import { fill, TRIES, Unfit } from "./ai";
import { admit, enter, gatePage } from "./gate";
import { page } from "./page";
import { draw, isName, load, names, type Name, type Scene } from "./scenes";
import { studio } from "./studio";

export { Session } from "./session";

/** Either binding may be missing: a deploy without the key, or a test with neither. */
type App = { Bindings: Partial<WorkerEnv> };

/** Set by scripts/build.ts, new on every build. */
declare const BUILD: string;

const PROMPT_LIMIT = 600;
const MESSAGE_LIMIT = 2000;

const nameOf = (c: Context<App>, extension: string) =>
  c.req.param("file")?.slice(0, -extension.length) ?? "";

const unknown = (name: string) =>
  `There is no template named "${name}". Pick one of: ${names.join(", ")}.`;

const reason = (error: Error | string) => (error instanceof Error ? error.message : error);

const queried = (name: Name, scene: Scene, query: URLSearchParams) => {
  try {
    return draw(scene, query.get("params") ?? fromEntries(scene.params, query));
  } catch (error) {
    throw new HTTPException(400, {
      message: `These values do not fit the ${name} template: ${reason(error instanceof Error ? error : String(error))} Fix the value in the URL; /${name}.json lists what each param takes.`,
    });
  }
};

/** The request's invitation code, or the gate's answer thrown: 501, or 401 for an API call. */
const admitted = async (c: Context<App>) => {
  const answer = await admit(c, false);

  if (answer instanceof Response)
    throw new HTTPException(answer.status === 501 ? 501 : 401, { res: answer });

  return answer.code;
};

/** Throws a 429 when this address, or this invitation code, has sent too many model requests this minute. */
const limited = async (c: Context<App>, code: string) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const byAddress = (await c.env.AI_LIMIT?.limit({ key: ip }))?.success ?? true;
  const byCode = (await c.env.CODE_LIMIT?.limit({ key: code }))?.success ?? true;

  if (!byAddress || !byCode)
    throw new HTTPException(429, {
      message: "You have sent a lot of requests in the last minute. Wait a minute and try again.",
    });
};

const prompted = async (name: Name, scene: Scene, prompt: string, c: Context<App>) => {
  const key = c.env.DEEPSEEK_API_KEY;

  if (key === undefined)
    throw new HTTPException(501, {
      message: `Prompts are turned off on this server, because it has no model key. Fill the template in the URL instead; /${name}.json lists its params.`,
    });

  if (prompt.length > PROMPT_LIMIT)
    throw new HTTPException(400, {
      message: `Your prompt is ${prompt.length} characters, and the limit is ${PROMPT_LIMIT}. Shorten it and try again.`,
    });

  await limited(c, await admitted(c));

  try {
    return await fill(scene.params, prompt, (json) => draw(scene, json), { key });
  } catch (error) {
    throw new HTTPException(502, {
      message:
        error instanceof Unfit
          ? `The model's answer did not fit the ${name} template after ${TRIES} tries: ${error.message} Try asking for something shorter or simpler, or pick another template.`
          : "The model could not be reached, or did not answer in time. Try again in a minute.",
    });
  }
};

const app = new Hono<App>();

app.get("/gate", (c) => c.html(gatePage(c.req.query("next") ?? "/")));

app.post("/gate", (c) => enter(c));

/** The session named in the path, when the deploy has the SESSIONS binding. */
const session = (c: Context<App>, id: string) => {
  if (!c.env.SESSIONS)
    throw new HTTPException(501, { message: "Sessions are not set up on this server." });

  return c.env.SESSIONS.getByName(id);
};

const SESSION = "[0-9a-f-]{36}";

app.get("/new", async (c) => {
  const answer = await admit(c, true);

  return answer instanceof Response ? answer : c.redirect(`/s/${crypto.randomUUID()}`);
});

// Public: an id is a random UUID, so a deck's URL is as private as the person keeps it, and it can be embedded.
app.get(`/s/:file{${SESSION}\\.svg}`, async (c) => {
  c.header("content-type", "image/svg+xml; charset=utf-8");
  c.header("cache-control", "no-store");

  return c.body(await session(c, c.req.param("file").slice(0, -4)).svg());
});

app.get(`/s/:id{${SESSION}}`, async (c) => {
  const answer = await admit(c, true);

  return answer instanceof Response ? answer : c.html(studio(c.req.param("id")));
});

app.get(`/s/:id{${SESSION}}/state`, async (c) => {
  await admitted(c);

  return c.json(await session(c, c.req.param("id")).state());
});

app.post(`/s/:id{${SESSION}}/undo`, async (c) => {
  await admitted(c);

  const outcome = await session(c, c.req.param("id")).undo();

  return outcome.status === 200 ? c.json(outcome.value) : c.text(outcome.error, outcome.status);
});

app.post(`/s/:id{${SESSION}}/message`, async (c) => {
  await limited(c, await admitted(c));

  // SAFETY: the page posts JSON; a missing or odd text reads as empty and is refused below.
  const { text = "" } = (await c.req.json().catch(() => ({}))) as { text?: unknown };
  const message = String(text);

  if (message.length > MESSAGE_LIMIT)
    return c.text(
      `Your message is ${message.length} characters, and the limit is ${MESSAGE_LIMIT}.`,
      400,
    );

  const outcome = await session(c, c.req.param("id")).message(message);

  if (outcome.status !== 200) return c.text(outcome.error, outcome.status);

  return new Response(outcome.value, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
});

app.get("/", async (c) =>
  c.html(
    page(
      await Promise.all(names.map(async (name) => ({ name, params: (await load(name)).params }))),
      BUILD,
    ),
  ),
);

app.get("/generate", async (c) => {
  const answer = await admit(c, true);

  if (answer instanceof Response) return answer;

  const template = c.req.query("template") ?? "";

  if (!isName(template)) return c.text(unknown(template), 404);

  return c.redirect(
    `/${template}.svg?${new URLSearchParams({ prompt: (c.req.query("prompt") ?? "").trim() })}`,
  );
});

// Below the index, so a browser never keeps an old list of templates.
app.use(cache({ cacheName: `svjeez-worker-${BUILD}`, cacheControl: "public, max-age=3600" }));

app.get("/:file{[a-z-]+\\.json}", async (c) => {
  const name = nameOf(c, ".json");

  if (!isName(name)) return c.text(unknown(name), 404);

  const { params } = await load(name);

  return c.json({ params: jsonSchema(params), defaults: defaults(params) });
});

app.get("/:file{[a-z-]+\\.svg}", async (c) => {
  const name = nameOf(c, ".svg");

  if (!isName(name)) return c.text(unknown(name), 404);

  const scene = await load(name);
  const query = new URL(c.req.url).searchParams;
  const prompt = query.get("prompt");

  // `v` is the build id the index puts on thumbnails, so a deploy is never served an old render.
  query.delete("v");

  const svg =
    prompt === null ? queried(name, scene, query) : await prompted(name, scene, prompt.trim(), c);

  c.header("content-type", "image/svg+xml; charset=utf-8");

  return c.body(svg);
});

app.notFound((c) =>
  c.text(
    `There is no page here. Open / to pick a template, or ask for /<name>.svg with one of: ${names.join(", ")}.`,
    404,
  ),
);

export default app;
