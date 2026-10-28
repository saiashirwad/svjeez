import assert from "node:assert/strict";
import * as lucide from "@svjeez/icons/lucide";
import * as tabler from "@svjeez/icons/tabler";

assert.equal(tabler.rocket.paths.length, 3);

assert.equal(tabler.checkFilled.kind, "fill");

assert.equal(Object.keys(tabler).length > 6000, true);

assert.equal(Object.keys(lucide).length > 2000, true);

console.log(
  `loaded ${Object.keys(tabler).length} Tabler and ${Object.keys(lucide).length} Lucide icons`,
);
