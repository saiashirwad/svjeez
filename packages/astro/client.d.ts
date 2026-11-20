/// <reference types="astro/client" />
/// <reference types="@svjeez/vite/client" />

declare module "virtual:svjeez/routes" {
  const routes: string[];
  export default routes;
}

declare module "virtual:svjeez/og" {
  const cards: Record<string, () => Promise<{ default: import("@svjeez/astro/og").OgCard }>>;
  export default cards;
}
