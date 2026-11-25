import { mount } from "svjeez/page";
import svg from "../dist/gpu-card.svg" with { type: "text" };

const card = document.querySelector<HTMLElement>("#card")!;
const toggle = document.querySelector<HTMLButtonElement>("#toggle")!;

card.innerHTML = svg;

// mount() takes over the storm clock and draws the <Shader> in its slot with WebGPU, over the still aurora.
const storm = mount(card.querySelector("svg")!).clock("storm");

toggle.addEventListener("click", () => {
  const stormy = toggle.getAttribute("aria-pressed") !== "true";

  toggle.setAttribute("aria-pressed", String(stormy));
  toggle.textContent = stormy ? "Calm" : "Storm";
  void (stormy ? storm.play() : storm.reverse());
});
