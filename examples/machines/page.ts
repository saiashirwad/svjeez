import { machine, mount, rests, type Mounted } from "svjeez/page";
import { createActor, setup, stateIn, assign } from "xstate";
import hoverCard from "../dist/hover-card.svg" with { type: "text" };
import stepper from "../dist/stepper.svg" with { type: "text" };
import tabs from "../dist/tabs.svg" with { type: "text" };
import toggle from "../dist/toggle.svg" with { type: "text" };
import form from "../dist/xstate-form.svg" with { type: "text" };

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

// XState decides what happens; rests() only says where each clock sits in each state.
const [formScene, formBox] = show("xstate-form", form);

const email = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface Form {
  readonly address: string;
}

type FormEvent =
  | { readonly type: "input"; readonly address: string }
  | { readonly type: "check" }
  | { readonly type: "submit" };

// SAFETY: XState reads these placeholders only as types and never uses them as values.
const types = { context: {} as Form, events: {} as FormEvent };

const signUp = setup({
  types,
  guards: { looksValid: ({ context }) => email.test(context.address) },
}).createMachine({
  id: "signUp",
  type: "parallel",
  context: { address: "" },
  states: {
    field: {
      initial: "empty",
      states: {
        empty: {},
        typing: {},
        valid: {},
        invalid: {},
      },
      on: {
        input: [
          {
            guard: ({ event }) => event.address === "",
            target: ".empty",
            actions: assign({ address: ({ event }) => event.address }),
          },
          { target: ".typing", actions: assign({ address: ({ event }) => event.address }) },
        ],
        check: [
          { guard: "looksValid", target: ".valid" },
          { guard: ({ context }) => context.address !== "", target: ".invalid" },
        ],
      },
    },
    submit: {
      initial: "idle",
      states: {
        idle: { on: { submit: { guard: stateIn({ field: "valid" }), target: "sending" } } },
        sending: { after: { 1400: "done" } },
        done: {},
      },
      on: { input: ".idle" },
    },
  },
});

const places = rests(formScene, {
  "field.empty": { focus: 0, verdict: 0, ready: 0 },
  "field.typing": { focus: 1, verdict: 0, ready: 0 },
  "field.valid": { focus: 1, verdict: 0.5, ready: 1 },
  "field.invalid": { focus: 1, verdict: 1, ready: 0 },
  "submit.idle": { send: 0 },
  "submit.sending": { send: 0.5 },
  "submit.done": { send: 1 },
});

const actor = createActor(signUp);

places.show(actor.getSnapshot().value);

actor.subscribe((snapshot) => {
  formBox.dataset.state = JSON.stringify(snapshot.value);
  places.go(snapshot.value);
});

actor.start();

// The scene draws the field; a real input sits over it.
const input = formBox.appendChild(document.createElement("input"));

input.placeholder = "you@example.com";

input.autocomplete = "off";

input.addEventListener("input", () => actor.send({ type: "input", address: input.value }));

input.addEventListener("blur", () => actor.send({ type: "check" }));

input.addEventListener("keydown", ({ key }) => {
  if (key === "Enter") actor.send({ type: "check" });
});

listen(formScene, "submit", "click", () => actor.send({ type: "submit" }));
