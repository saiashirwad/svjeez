/** world-atlas's countries at 1:110m, a TopoJSON topology. The bundler inlines the JSON. */
declare module "world-atlas/countries-110m.json" {
  import type { Topology } from "@svjeez/geo";

  const topology: Topology;
  export default topology;
}
