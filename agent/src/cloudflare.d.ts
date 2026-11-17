/** The one runtime module the Worker imports. Its types come from the importable form of @cloudflare/workers-types. */
declare module "cloudflare:workers" {
  import type { CloudflareWorkersModule } from "@cloudflare/workers-types";

  export import DurableObject = CloudflareWorkersModule.DurableObject;
}
