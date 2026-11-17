import { Hono, type Context } from "hono";
import { HTTPException } from "hono/http-exception";

import type { AgentEnv } from "../alchemy.run.ts";
import { admitted, enter, local } from "./gate";
import { gatePage } from "./pages/gate";
import { home } from "./pages/home";
import { studio } from "./pages/studio";

export { Session } from "./session";

/** Any binding may be missing: a deploy without a secret, or a test without the rate limits. */
type App = { Bindings: Partial<AgentEnv> };

const app = new Hono<App>();

const ID = "[0-9a-f-]{36}";

/** The session named `id`, when the deploy has the SESSIONS binding. */
const session = (c: Context<App>, id: string) => {
  if (!c.env.SESSIONS)
    throw new HTTPException(501, { message: "Sessions are not set up on this server." });

  return c.env.SESSIONS.getByName(id);
};

/** The request's invitation code, or the gate's answer thrown: 501, or 401 for an API call. */
const code = async (c: Context<App>) => {
  const answer = await admitted(c);

  if (answer instanceof Response) throw new HTTPException(501, { res: answer });

  if (answer === undefined)
    throw new HTTPException(401, {
      message: "This needs an invitation code. Enter yours at /gate, then try again.",
    });

  return answer;
};

/** Throws a 429 when this address, or this invitation code, has asked the agent too often this minute. */
const limited = async (c: Context<App>, invitation: string) => {
  const ip = c.req.header("cf-connecting-ip") ?? "unknown";
  const byAddress = (await c.env.AI_LIMIT?.limit({ key: ip }))?.success ?? true;
  const byCode = (await c.env.CODE_LIMIT?.limit({ key: invitation }))?.success ?? true;

  if (!byAddress || !byCode)
    throw new HTTPException(429, {
      message: "That is a lot of requests in one minute. Wait a minute and try again.",
    });
};

/** Starts a session on `prompt` and sends the person to it, or back home with why it could not start. */
const start = async (c: Context<App>, invitation: string, prompt: string) => {
  await limited(c, invitation);

  const id = crypto.randomUUID();
  const outcome = await session(c, id).message(prompt);

  return outcome.status === 200
    ? c.redirect(`/s/${id}`, 303)
    : c.html(home(prompt, outcome.error), outcome.status);
};

app.get("/", (c) => c.html(home()));

app.post("/new", async (c) => {
  const prompt = String((await c.req.formData()).get("prompt") ?? "").trim();
  const answer = await admitted(c);

  if (answer instanceof Response) return answer;

  if (answer === undefined) return c.html(gatePage("/", prompt));

  if (!prompt) return c.html(home("", "Describe what you want first."), 400);

  return start(c, answer, prompt);
});

app.get("/gate", (c) => c.html(gatePage(local(c.req.query("next")))));

app.post("/gate", async (c) => {
  const form = await c.req.formData();
  const next = local(String(form.get("next") ?? "/"));
  const prompt = String(form.get("prompt") ?? "").trim();
  const answer = await enter(c, String(form.get("code") ?? "").trim());

  if (answer instanceof Response) return answer;

  if ("error" in answer) return c.html(gatePage(next, prompt, answer.error), 403);

  return prompt ? start(c, answer.code, prompt) : c.redirect(next, 303);
});

// Public: an id is a random UUID, so a scene's URL is as private as the person keeps it, and it can be embedded.
app.get(`/s/:file{${ID}\\.(?:svg|tsx)}`, async (c) => {
  const file = c.req.param("file");
  const scene = await session(c, file.slice(0, -4)).scene();

  if (!scene) return c.text("This session has no scene yet.", 404);

  c.header("cache-control", "no-store");

  return file.endsWith(".svg")
    ? c.body(scene.svg, 200, { "content-type": "image/svg+xml; charset=utf-8" })
    : c.text(scene.source);
});

app.get(`/s/:id{${ID}}`, async (c) => {
  const answer = await admitted(c);

  if (answer instanceof Response) return answer;

  if (answer === undefined) return c.redirect(`/gate?${new URLSearchParams({ next: c.req.path })}`);

  return c.html(studio(c.req.param("id")));
});

app.get(`/s/:id{${ID}}/state`, async (c) => {
  await code(c);

  return c.json(await session(c, c.req.param("id")).state());
});

app.get(`/s/:id{${ID}}/watch`, async (c) => {
  await code(c);

  return new Response(await session(c, c.req.param("id")).watch(), {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
});

app.post(`/s/:id{${ID}}/undo`, async (c) => {
  await code(c);

  const outcome = await session(c, c.req.param("id")).undo();

  return outcome.status === 200 ? c.json(outcome.value) : c.text(outcome.error, outcome.status);
});

app.post(`/s/:id{${ID}}/message`, async (c) => {
  await limited(c, await code(c));

  // SAFETY: the page posts JSON; a missing or odd text reads as empty and the session refuses it.
  const { text = "" } = (await c.req.json().catch(() => ({}))) as { text?: unknown };
  const outcome = await session(c, c.req.param("id")).message(String(text));

  return outcome.status === 200 ? c.body(null, 202) : c.text(outcome.error, outcome.status);
});

app.onError((error, c) =>
  error instanceof HTTPException
    ? error.getResponse()
    : c.text("Something went wrong on our side. Try again.", 500),
);

export default app;
