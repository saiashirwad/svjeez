import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

// seedy.texoport.in: the game, built by Vite and served as static assets.
export default Alchemy.Stack(
  "Mossbell",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.StaticSite("Game", {
      command: "vite build",
      outdir: "dist",
      domain: "seedy.texoport.in",
    });

    return { url: site.url };
  }),
);
