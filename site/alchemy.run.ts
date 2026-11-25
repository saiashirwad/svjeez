import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "SvjeezSite",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.Astro("Website", {
      astro: { output: "static" },
      prerenderEnvironment: "node",
      assets: { notFoundHandling: "404-page" },
      domain: "svjeez.texoport.in",
    });

    return { url: site.url };
  }),
);
