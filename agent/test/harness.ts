import type { WorkerLoader } from "@cloudflare/workers-types";

import { compile } from "../src/sandbox";

/** The sandbox alone, for the tests: POST a scene's source, get the compile's answer. */
export default {
  fetch: async (request: Request, env: { readonly LOADER: WorkerLoader }) =>
    Response.json(await compile(env.LOADER, await request.text())),
};
