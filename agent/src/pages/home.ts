import { html } from "hono/html";

import { LIMITS } from "../limits";
import { layout } from "./layout";

const EXAMPLES = [
  ["How HTTPS works", "A 20-second animated explainer of how HTTPS works"],
  ["The Silk Road", "An illustrated map of the Silk Road's main routes and cities"],
  ["A product launch", "A launch video for a coffee subscription called Grind and Go"],
  ["Bubble sort", "Bubble sort on eight bars, one comparison at a time"],
] as const;

const SCRIPT = `
const box = document.getElementById("prompt");
for (const example of document.querySelectorAll("[data-prompt]")) {
  example.addEventListener("click", () => { box.value = example.dataset.prompt; box.focus(); });
}
`;

/** The home page: one prompt box. `prompt` refills it and `error` explains why it came back. */
export const home = (prompt = "", error = "") =>
  layout(
    "svjeez agent",
    html`<main class="calm">
  <p class="name">svjeez agent</p>
  <h1>Describe an animation, and get it as one animated SVG.</h1>
  <form method="post" action="/new">
    <label class="visually-hidden" for="prompt">What should it show?</label>
    <textarea id="prompt" name="prompt" rows="4" maxlength="${LIMITS.message}" required autofocus placeholder="What should it show?">${prompt}</textarea>
    <div class="actions"><p class="error" role="alert">${error}</p><button class="primary">Generate</button></div>
  </form>
  <p class="examples">${EXAMPLES.map(([label, text]) => html`<button type="button" data-prompt="${text}">${label}</button>`)}</p>
</main>`,
    SCRIPT,
  );
