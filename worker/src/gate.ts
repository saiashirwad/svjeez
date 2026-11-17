import type { Context } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { html } from "hono/html";
import { timingSafeEqual } from "hono/utils/buffer";

/** The secrets the gate needs. Either missing turns the gated routes off: they answer 501, never open. */
export interface GateEnv {
  /** Invitation codes, comma-separated. */
  readonly INVITE_CODES?: string;
  /** The key that signs the cookie a code is kept in. */
  readonly SESSION_SECRET?: string;
}

const COOKIE = "invite";

const codesOf = (env: GateEnv) =>
  (env.INVITE_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

const known = async (env: GateEnv, code: string) => {
  const matches = await Promise.all(codesOf(env).map((each) => timingSafeEqual(each, code)));

  return matches.includes(true);
};

/** A path on this site to come back to, or the index: a gate never sends anyone elsewhere. */
const local = (next: string | undefined) =>
  next?.startsWith("/") && !next.startsWith("//") ? next : "/";

/**
 * The invitation code the request carries in its signed cookie, when the code is still one of the server's. Otherwise a
 * response: 501 when the gate's secrets are missing, a redirect to the gate for a page, and 401 for anything else.
 */
export const admit = async <E extends { Bindings: GateEnv }>(
  c: Context<E>,
  page: boolean,
): Promise<{ readonly code: string } | Response> => {
  const secret = c.env.SESSION_SECRET;

  if (!secret || codesOf(c.env).length === 0)
    return c.text("Invitations are not set up on this server, so this part is turned off.", 501);

  const code = await getSignedCookie(c, secret, COOKIE);

  if (code && (await known(c.env, code))) return { code };

  return page
    ? c.redirect(
        `/gate?${new URLSearchParams({ next: c.req.url.slice(new URL(c.req.url).origin.length) })}`,
      )
    : c.text("This needs an invitation code. Enter yours at /gate, then try again.", 401);
};

const STYLE = `
:root { color-scheme: light dark; font: 16px/1.5 system-ui, sans-serif; }
body { max-width: 26rem; margin: 15vh auto; padding: 0 1.5rem; }
input, button { font: inherit; padding: 0.5rem 0.75rem; border-radius: 8px; border: 1px solid #8884; }
form { display: flex; gap: 0.5rem; }
input { flex: 1; }
.error { color: #d93025; }
`;

/** The gate: one field for an invitation code. */
export const gatePage = (next: string, error = "") => html`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Invitation</title>
<style>${STYLE}</style></head>
<body>
<h1>Enter your invitation code</h1>
<p>Building decks and filling templates from a prompt uses a paid model, so it needs a code.</p>
<form method="post" action="/gate">
  <input name="code" autocomplete="off" required autofocus aria-label="Invitation code">
  <input type="hidden" name="next" value="${local(next)}">
  <button>Continue</button>
</form>
${error ? html`<p class="error" role="alert">${error}</p>` : ""}
<p><a href="/">Back to the templates</a></p>
</body>
</html>
`;

/** Checks a posted code; a known one is kept in a signed cookie for 30 days and the person goes on to `next`. */
export const enter = async <E extends { Bindings: GateEnv }>(c: Context<E>) => {
  const secret = c.env.SESSION_SECRET;

  if (!secret || codesOf(c.env).length === 0)
    return c.text("Invitations are not set up on this server, so this part is turned off.", 501);

  const form = await c.req.formData();
  const code = String(form.get("code") ?? "").trim();
  const next = local(String(form.get("next") ?? "/"));

  if (!(await known(c.env, code)))
    return c.html(gatePage(next, "That code is not one we know."), 403);

  await setSignedCookie(c, COOKIE, code, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return c.redirect(next, 303);
};
