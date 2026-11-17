import { Hono, type Context } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { defaults, fromEntries, jsonSchema, parse, type Schema } from "svjeez/params";

import type { WorkerEnv } from "../alchemy.run.ts";
import { fill } from "./ai";
import { page } from "./page";
import { isName, load, names } from "./scenes";

/** Either binding may be missing: a deploy without the key, or a test with neither. */
type App = { Bindings: Partial<WorkerEnv> };

const PROMPT_LIMIT = 300;

const sceneOf = async (c: Context<App>, extension: string) => {
  const name = c.req.param("file")?.slice(0, -extension.length) ?? "";

  return isName(name) ? { name, ...(await load(name)) } : undefined;
};

const read = (params: Schema, query: URLSearchParams) => {
  try {
    return parse(params, query.get("params") ?? fromEntries(params, query));
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const prompted = async (params: Schema, prompt: string, c: Context<App>) => {
  const key = c.env.DEEPSEEK_API_KEY;

  if (key === undefined)
    throw new HTTPException(501, {
      message:
        "This Worker has no DEEPSEEK_API_KEY, so it cannot read a prompt. Pass the params in the query.",
    });

  if (prompt.length > PROMPT_LIMIT)
    throw new HTTPException(400, {
      message: `The prompt is ${prompt.length} characters. Keep it to ${PROMPT_LIMIT}.`,
    });

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";

  if (c.env.AI_LIMIT && !(await c.env.AI_LIMIT.limit({ key: ip })).success)
    throw new HTTPException(429, {
      message: "Too many prompts from this address. Wait a minute and try again.",
    });

  try {
    return await fill(params, prompt, { key });
  } catch (error) {
    throw new HTTPException(502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const app = new Hono<App>();

app.use(cache({ cacheName: "svjeez-worker", cacheControl: "public, max-age=3600" }));

app.get("/", async (c) =>
  c.html(
    page(
      await Promise.all(names.map(async (name) => ({ name, params: (await load(name)).params }))),
    ),
  ),
);

app.get("/:file{[a-z-]+\\.json}", async (c) => {
  const params = (await sceneOf(c, ".json"))?.params;

  return params ? c.json({ params: jsonSchema(params), defaults: defaults(params) }) : c.notFound();
});

app.get("/:file{[a-z-]+\\.svg}", async (c) => {
  const scene = await sceneOf(c, ".svg");

  if (!scene) return c.notFound();

  const query = new URL(c.req.url).searchParams;
  const prompt = query.get("prompt");

  if (!scene.params && query.size > 0)
    throw new HTTPException(400, {
      message: `${scene.name} has no params, so the query has nothing to fill.`,
    });

  const values = !scene.params
    ? undefined
    : prompt === null
      ? read(scene.params, query)
      : await prompted(scene.params, prompt, c);

  c.header("content-type", "image/svg+xml; charset=utf-8");

  return c.body(scene.default(values));
});

app.notFound((c) =>
  c.text(`No such page. Try /, or /<name>.svg for one of: ${names.join(", ")}.`, 404),
);

export default app;
