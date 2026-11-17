import { Hono, type Context } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { defaults, fromEntries, jsonSchema } from "svjeez/params";

import type { WorkerEnv } from "../alchemy.run.ts";
import { fill, TRIES, Unfit } from "./ai";
import { page } from "./page";
import { draw, isName, load, names, type Name, type Scene } from "./scenes";

/** Either binding may be missing: a deploy without the key, or a test with neither. */
type App = { Bindings: Partial<WorkerEnv> };

/** Set by scripts/build.ts, new on every build. */
declare const BUILD: string;

const PROMPT_LIMIT = 600;

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

  const ip = c.req.header("cf-connecting-ip") ?? "unknown";

  if (c.env.AI_LIMIT && !(await c.env.AI_LIMIT.limit({ key: ip })).success)
    throw new HTTPException(429, {
      message: "You have sent a lot of prompts in the last minute. Wait a minute and try again.",
    });

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

app.get("/", async (c) =>
  c.html(
    page(
      await Promise.all(names.map(async (name) => ({ name, params: (await load(name)).params }))),
      BUILD,
    ),
  ),
);

app.get("/generate", (c) => {
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
