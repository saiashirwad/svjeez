import { html } from "hono/html";

import { layout } from "./layout";

/** The gate: one field for an invitation code. A prompt typed before it is carried through. */
export const gatePage = (next: string, prompt = "", error = "") =>
  layout(
    "Invitation · svjeez agent",
    html`<main class="calm">
  <p class="name">svjeez agent</p>
  <h1>Enter your invitation code.</h1>
  <form method="post" action="/gate">
    <label class="visually-hidden" for="code">Invitation code</label>
    <input id="code" name="code" autocomplete="off" required autofocus placeholder="Invitation code">
    <input type="hidden" name="next" value="${next}">
    <input type="hidden" name="prompt" value="${prompt}">
    <div class="actions"><p class="error" role="alert">${error}</p><button class="primary">Continue</button></div>
  </form>
</main>`,
  );
