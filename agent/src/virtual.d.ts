/** Written by scripts/build.ts. */
declare module "virtual:library" {
  import type { Library } from "./sandbox/library";

  const library: Library;
  export default library;
}
