import { Hono, type Context } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { defaults, fromEntries, jsonSchema } from "svjeez/params";

import type { WorkerEnv } from "../alchemy.run.ts";
import { fill } from "./ai";
import { page } from "./page";
import { draw, isName, load, names, type Scene } from "./scenes";

/** Either binding may be missing: a deploy without the key, or a test with neither. */
type App = { Bindings: Partial<WorkerEnv> };

/** Set by scripts/build.ts, new on every build. */
declare const BUILD: string;

const PROMPT_LIMIT = 600;

const sceneOf = async (c: Context<App>, extension: string) => {
  const name = c.req.param("file")?.slice(0, -extension.length) ?? "";

  return isName(name) ? load(name) : undefined;
};

const queried = (scene: Scene, query: URLSearchParams) => {
  try {
    return draw(scene, query.get("params") ?? fromEntries(scene.params, query));
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const prompted = async (scene: Scene, prompt: string, c: Context<App>) => {
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
    return await fill(scene.params, prompt, (json) => draw(scene, json), { key });
  } catch (error) {
    throw new HTTPException(502, {
      message: error instanceof Error ? error.message : String(error),
    });
  }
};

const app = new Hono<App>();

app.get("/", async (c) =>
  c.html(
    page(
      await Promise.all(names.map(async (name) => ({ name, params: (await load(name)).params }))),
    ),
  ),
);

app.get("/generate", (c) => {
  const template = c.req.query("template") ?? "";

  if (!isName(template)) return c.notFound();

  return c.redirect(
    `/${template}.svg?${new URLSearchParams({ prompt: c.req.query("prompt") ?? "" })}`,
  );
});

// Below the index, so a browser never keeps an old list of templates.
app.use(cache({ cacheName: `svjeez-worker-${BUILD}`, cacheControl: "public, max-age=3600" }));

app.get("/:file{[a-z-]+\\.json}", async (c) => {
  const scene = await sceneOf(c, ".json");

  return scene
    ? c.json({ params: jsonSchema(scene.params), defaults: defaults(scene.params) })
    : c.notFound();
});

app.get("/:file{[a-z-]+\\.svg}", async (c) => {
  const scene = await sceneOf(c, ".svg");

  if (!scene) return c.notFound();

  const query = new URL(c.req.url).searchParams;
  const prompt = query.get("prompt");
  const svg = prompt === null ? queried(scene, query) : await prompted(scene, prompt, c);

  c.header("content-type", "image/svg+xml; charset=utf-8");

  return c.body(svg);
});

app.notFound((c) =>
  c.text(`No such page. Try /, or /<name>.svg for one of: ${names.join(", ")}.`, 404),
);

export default app;
