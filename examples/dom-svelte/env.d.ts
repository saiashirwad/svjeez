/// <reference types="vite/client" />
/// <reference types="svelte" />

declare module "*.css" {
  const href: string;
  export default href;
}
