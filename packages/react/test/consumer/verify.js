import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { Scene } from "@svjeez/react";
import { Shape, rect, scene } from "svjeez";
import { svg } from "svjeez/tools";

const markup = svg.emit(
  scene({ size: [60, 40], duration: 1, title: "Switch" }, () =>
    Shape({ geometry: rect(10, 10), fill: "#000000" }),
  ),
);

const html = renderToString(
  createElement(Scene, { scene: { svg: markup, width: 60, height: 40 } }),
);

assert.match(html, /^<span aria-hidden="true"/);

assert.match(html, /<svg [^>]*width="100%"/);

console.log("rendered a scene on the server");
