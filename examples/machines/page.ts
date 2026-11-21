import { machine, mount, type Mounted } from "svjeez/page";
import hoverCard from "../dist/hover-card.svg" with { type: "text" };
import stepper from "../dist/stepper.svg" with { type: "text" };
import tabs from "../dist/tabs.svg" with { type: "text" };
import toggle from "../dist/toggle.svg" with { type: "text" };

interface Watched {
  readonly state: string;
  subscribe(listener: (state: string) => void): () => void;
}

// Put a built scene into #id and mount it.
const show = (id: string, markup: string): [Mounted, HTMLElement] => {
  const box = document.querySelector<HTMLElement>(`#${id}`)!;

  box.innerHTML = markup;

  return [mount(box.querySelector("svg")!), box];
};

// Events are plain DOM events on the scene's `hit` shapes.
const listen = (scene: Mounted, hit: string, type: string, run: () => void) =>
  scene.hit(hit).forEach((shape) => shape.addEventListener(type, run));

// Show a machine's state as the box's data-state.
const follow = (box: HTMLElement, watched: Watched) => {
  box.dataset.state = watched.state;
  watched.subscribe((state) => (box.dataset.state = state));
};

const [toggleScene, toggleBox] = show("toggle", toggle);

const power = machine(toggleScene, {
  initial: "off",
  states: { off: { flip: 0 }, on: { flip: 1 } },
  on: { press: { off: "on", on: "off" } },
});

follow(toggleBox, power);

listen(toggleScene, "switch", "click", () => power.send("press"));

const [tabScene, tabBox] = show("tabs", tabs);

const choice = machine(tabScene, {
  initial: "overview",
  states: {
    overview: { pill: 0, panel: 0 },
    usage: { pill: 0.5, panel: 0.5 },
    billing: { pill: 1, panel: 1 },
  },
  on: {},
});

follow(tabBox, choice);

for (const name of ["overview", "usage", "billing"] as const)
  listen(tabScene, `tab-${name}`, "click", () => choice.go(name));

const [stepScene, stepBox] = show("stepper", stepper);
const order = ["plan", "build", "test", "ship"] as const;

// Next and back stop at the ends.
const walk = (by: number) => (state: (typeof order)[number]) =>
  order[Math.min(order.length - 1, Math.max(0, order.indexOf(state) + by))];

const progress = machine(stepScene, {
  initial: "plan",
  states: {
    plan: { step: 0 },
    build: { step: 1 / 3 },
    test: { step: 2 / 3 },
    ship: { step: 1 },
  },
  on: { next: walk(1), back: walk(-1) },
});

follow(stepBox, progress);

for (const event of ["next", "back"] as const)
  listen(stepScene, event, "click", () => progress.send(event));

document.addEventListener("keydown", ({ key }) => {
  if (key === "ArrowRight") progress.send("next");

  if (key === "ArrowLeft") progress.send("back");
});

const [cardScene, cardBox] = show("hover-card", hoverCard);

const card = machine(cardScene, {
  initial: "rest",
  states: { rest: { hover: 0 }, hover: { hover: 1 } },
  on: { enter: { rest: "hover" }, leave: { hover: "rest" } },
});

follow(cardBox, card);

listen(cardScene, "card", "pointerenter", () => card.send("enter"));

listen(cardScene, "card", "pointerleave", () => card.send("leave"));
