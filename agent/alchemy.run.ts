import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import type { Sessions } from "./src/session.ts";

/**
 * Rate-limit namespaces are account-wide, so each stage counts in its own. The default stage keeps 1101 and 1102
 * (worker/ uses 1001 and 1002); a named stage (ALCHEMY_STAGE, as agent/.env sets it) gets a pair derived from its name.
 */
const stage = process.env.ALCHEMY_STAGE;

const base = stage
  ? 3000 + [...stage].reduce((hash, c) => (hash * 31 + c.charCodeAt(0)) % 400_000, 0) * 2
  : 1100;

const AI_LIMIT = Cloudflare.RateLimit("AI_LIMIT", {
  namespaceId: base + 1,
  simple: { limit: 10, period: 60 },
});

const CODE_LIMIT = Cloudflare.RateLimit("CODE_LIMIT", {
  namespaceId: base + 2,
  simple: { limit: 20, period: 60 },
});

const SESSIONS = Cloudflare.DurableObject("SESSIONS", { className: "Session" });

/** Scenes compile in Dynamic Workers, which need the Workers Paid plan. */
const LOADER = Cloudflare.WorkerLoader("LOADER");

/**
 * The secrets, each bound only when the deploy's environment has it. Without DEEPSEEK_API_KEY the agent answers 501;
 * without INVITE_CODES or SESSION_SECRET every route that needs an invitation answers 501.
 */
const secrets = Object.fromEntries(
  ["DEEPSEEK_API_KEY", "INVITE_CODES", "SESSION_SECRET"].flatMap((name) => {
    const value = process.env[name];

    return value ? [[name, Redacted.make(value)]] : [];
  }),
);

// The agent: a prompt in, a scene compiled in a sandbox out. dist/worker.js comes from `bun run build`. Each stage has
// its own Worker, Durable Objects and state; WORKER_DOMAIN gives a stage its own domain.
export const Agent = Cloudflare.Worker("Agent", {
  main: "./dist/worker.js",
  bundle: false,
  domain: process.env.WORKER_DOMAIN ?? "svjeez-agent.texoport.in",
  // Matches the workerd the tests run on. No nodejs_compat: neither the agent nor the scenes need it.
  compatibility: { date: "2026-07-30", flags: [] },
  env: { AI_LIMIT, CODE_LIMIT, SESSIONS, LOADER, ...secrets },
});

/** The bindings the Worker may see. The secrets are bound only when the deploy has them. */
export type AgentEnv = Cloudflare.InferEnv<{
  readonly AI_LIMIT: typeof AI_LIMIT;
  readonly CODE_LIMIT: typeof CODE_LIMIT;
  readonly DEEPSEEK_API_KEY: Redacted.Redacted<string>;
  readonly INVITE_CODES: Redacted.Redacted<string>;
  readonly SESSION_SECRET: Redacted.Redacted<string>;
}> & { readonly SESSIONS: Sessions };

export default Alchemy.Stack(
  "SvjeezAgent",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const agent = yield* Agent;

    return { url: agent.url };
  }),
);
