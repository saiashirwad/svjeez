// oxlint-disable-next-line typescript/triple-slash-reference
/// <reference path="../client.d.ts" />

import { defineMiddleware } from "astro:middleware";
import { isScene } from "svjeez/tools";
import { getStill } from "@svjeez/vite/scene";
import cards from "virtual:svjeez/og";
import { ogTags } from "./tags";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();
  const load = cards[context.routePattern];

  if (!load || !response.headers.get("content-type")?.includes("text/html")) return response;

  const html = await response.text();
  const kept = new Response(html, response);

  if (html.includes('property="og:image"')) return kept;

  const { default: card } = await load();

  const scene = isScene(card)
    ? card
    : await card({ params: context.params, props: context.props, url: context.url });

  return new Response(
    html.replace("</head>", `  ${ogTags(getStill(scene), context.site ?? context.url)}\n  </head>`),
    response,
  );
});
