import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

// typejeez.texoport.in: this page, built by Vite and served as static assets.
export default Alchemy.Stack(
  "TypejeezSite",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.StaticSite("Website", {
      command: "bunx --bun vite build",
      outdir: "dist",
      domain: "typejeez.texoport.in",
    });

    return { url: site.url };
  }),
);
