import type { Context } from "hono";
import { getSignedCookie, setSignedCookie } from "hono/cookie";
import { timingSafeEqual } from "hono/utils/buffer";

/** The secrets the gate needs. Either missing turns the gated routes off: they answer 501, never open. */
export interface GateEnv {
  /** Invitation codes, comma-separated. */
  readonly INVITE_CODES?: string;
  /** The key that signs the cookie a code is kept in. */
  readonly SESSION_SECRET?: string;
}

const COOKIE = "invite";

const OFF = "Invitations are not set up on this server, so the agent is turned off.";

const codesOf = (env: GateEnv) =>
  (env.INVITE_CODES ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code) => code !== "");

const known = async (env: GateEnv, code: string) => {
  const matches = await Promise.all(codesOf(env).map((each) => timingSafeEqual(each, code)));

  return matches.includes(true);
};

/** A path on this site to come back to, or the home page: the gate never sends anyone elsewhere. */
export const local = (next: string | undefined) =>
  next?.startsWith("/") && !next.startsWith("//") ? next : "/";

/**
 * The invitation code the request carries in its signed cookie, when it is still one of the server's; `undefined`
 * when it carries none; or a 501 response when the gate's secrets are missing.
 */
export const admitted = async <E extends { Bindings: GateEnv }>(
  c: Context<E>,
): Promise<string | undefined | Response> => {
  const secret = c.env.SESSION_SECRET;

  if (!secret || codesOf(c.env).length === 0) return c.text(OFF, 501);

  const code = await getSignedCookie(c, secret, COOKIE);

  return code && (await known(c.env, code)) ? code : undefined;
};

/**
 * Checks a posted code. A known one is kept in a signed, HttpOnly cookie for 30 days and returned; otherwise the
 * answer is a sentence to show beside the field, or a 501 response when the gate's secrets are missing.
 */
export const enter = async <E extends { Bindings: GateEnv }>(
  c: Context<E>,
  code: string,
): Promise<{ readonly code: string } | { readonly error: string } | Response> => {
  const secret = c.env.SESSION_SECRET;

  if (!secret || codesOf(c.env).length === 0) return c.text(OFF, 501);

  if (!(await known(c.env, code)))
    return { error: "That code is not one we know. Check it and try again." };

  await setSignedCookie(c, COOKIE, code, secret, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });

  return { code };
};
