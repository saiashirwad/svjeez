import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

// svjeez.texoport.in: the Astro site, prerendered and served as static assets.
export default Alchemy.Stack(
  "SvjeezSite",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.Astro("Website", {
      astro: { output: "static" },
      // Posters render in headless Chromium, which only Node can drive.
      prerenderEnvironment: "node",
      domain: "svjeez.texoport.in",
    });

    return { url: site.url };
  }),
);
