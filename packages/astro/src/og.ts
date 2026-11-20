import type { Scene } from "svjeez/tools";

/** What a card is told about the page it is for: the route's params and props (from `getStaticPaths`) and its URL. */
export interface OgContext<Props = object> {
  readonly params: Readonly<Record<string, string | undefined>>;
  readonly props: Props;
  readonly url: URL;
}

/**
 * What a card file beside a page (`_about.og.tsx` for `about.astro`) exports as its default: a scene, or a function from
 * the page to one.
 */
export type OgCard<Props = object> =
  | Scene
  | ((context: OgContext<Props>) => Scene | Promise<Scene>);
