import * as Cloudflare from "@alchemy.run/cloudflare";
import * as Alchemy from "alchemy";
import * as Effect from "effect/Effect";

// svjeez.texoport.in: the landing scene, full screen, served as static assets from a Worker.
export default Alchemy.Stack(
  "SvjeezSite",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const site = yield* Cloudflare.Website.StaticSite("Website", {
      command: "bun run build",
      outdir: "public",
      domain: "svjeez.texoport.in",
    });
    return { url: site.url };
  }),
);
