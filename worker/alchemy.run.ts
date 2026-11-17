import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

const key = process.env.DEEPSEEK_API_KEY;

const AI_LIMIT = Cloudflare.RateLimit("AI_LIMIT", {
  namespaceId: 1001,
  simple: { limit: 10, period: 60 },
});

// svjeez-worker.texoport.in: the examples' scenes rendered on request. dist/worker.js comes from `bun run build`.
export const Worker = Cloudflare.Worker("Worker", {
  main: "./dist/worker.js",
  bundle: false,
  domain: "svjeez-worker.texoport.in",
  // Matches the workerd the tests run on. No nodejs_compat: the scenes need none.
  compatibility: { date: "2026-07-30", flags: [] },
  // Without a key the Worker still deploys, and answers ?prompt= with a 501.
  env: key === undefined ? { AI_LIMIT } : { AI_LIMIT, DEEPSEEK_API_KEY: Redacted.make(key) },
});

/** The bindings the Worker may see. DEEPSEEK_API_KEY is bound only when the deploy has one. */
export type WorkerEnv = Cloudflare.InferEnv<{
  readonly AI_LIMIT: typeof AI_LIMIT;
  readonly DEEPSEEK_API_KEY: Redacted.Redacted<string>;
}>;

export default Alchemy.Stack(
  "SvjeezWorker",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const worker = yield* Worker;

    return { url: worker.url };
  }),
);
