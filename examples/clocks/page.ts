import { mount, scrolled } from "svjeez/page";
import svg from "../dist/clocks.svg" with { type: "text" };

const card = document.querySelector<HTMLElement>("#card")!;

card.innerHTML = svg;

const scene = mount(card.querySelector("svg")!);
const open = scene.clock("open");

card.addEventListener("click", () => (open.time > 0 ? open.reverse() : open.play()));

scene.clock("grow").follow(scrolled(card));
