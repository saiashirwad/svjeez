import assert from "node:assert/strict";
import { Icon } from "@svjeez/icons";
import * as lucide from "@svjeez/icons/lucide";
import * as tabler from "@svjeez/icons/tabler";
import { scene } from "svjeez";
import { svg } from "svjeez/tools";

assert.equal(tabler.rocket.paths.length, 3);

assert.equal(tabler.checkFilled.kind, "fill");

assert.equal(Object.keys(tabler).length > 6000, true);

assert.equal(Object.keys(lucide).length > 2000, true);

const markup = svg.emit(
  scene({ size: [64, 64], duration: 1, title: "Rocket" }, () =>
    Icon({ icon: tabler.rocket, color: "#000000", size: 48 }),
  ),
);

assert.equal(markup.match(/<path /g)?.length, 3);

console.log(
  `loaded ${Object.keys(tabler).length} Tabler and ${Object.keys(lucide).length} Lucide icons`,
);
