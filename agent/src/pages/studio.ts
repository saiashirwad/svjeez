import { html } from "hono/html";

import { LIMITS } from "../limits";
import { layout } from "./layout";

const SCRIPT = `
const id = document.querySelector("main").dataset.id;
const $ = (name) => document.getElementById(name);
const scene = $("scene"), live = $("live"), steps = $("steps"), list = steps.querySelector("ol");
const summary = $("summary"), bar = $("bar"), form = $("change"), box = form.querySelector("textarea");
const error = $("error"), undo = $("undo"), copy = $("copy");

const say = (text, working) => { live.textContent = text; live.classList.toggle("working", working); };
const step = (text) => { const item = document.createElement("li"); item.textContent = text; list.append(item); };
const busy = (on) => { bar.hidden = on; };

const show = (state) => {
  const has = state.version > 0;
  scene.hidden = !has;
  if (has) scene.src = "/s/" + id + ".svg?v=" + state.version;
  for (const link of bar.querySelectorAll("[data-scene]")) link.hidden = !has;
  undo.disabled = state.version < 2;
  const last = state.log.filter((line) => line.role === "assistant").at(-1);
  summary.textContent = last ? last.text : "";
  const turn = state.log.slice(state.log.findLastIndex((line) => line.role === "user") + 1);
  list.replaceChildren();
  for (const line of turn) if (line.role === "progress") step(line.text);
  steps.hidden = list.children.length === 0;
};

const load = async () => {
  const state = await (await fetch("/s/" + id + "/state")).json();
  show(state);
  return state;
};

const watch = async () => {
  busy(true);
  say("Starting…", true);
  list.replaceChildren();
  steps.hidden = false;
  const response = await fetch("/s/" + id + "/watch");
  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let rest = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    const lines = (rest + value).split("\\n");
    rest = lines.pop();
    for (const raw of lines) {
      if (!raw) continue;
      const event = JSON.parse(raw);
      if (event.type === "progress") { say(event.text, true); step(event.text); }
    }
  }
  say("", false);
  await load();
  busy(false);
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = box.value.trim();
  if (!text) return;
  error.textContent = "";
  busy(true);
  const response = await fetch("/s/" + id + "/message", {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }),
  });
  if (!response.ok) { error.textContent = await response.text(); busy(false); return; }
  box.value = "";
  summary.textContent = "";
  await watch();
});

undo.addEventListener("click", async () => {
  error.textContent = "";
  const response = await fetch("/s/" + id + "/undo", { method: "POST" });
  if (response.ok) show(await response.json()); else error.textContent = await response.text();
});

copy.addEventListener("click", async () => {
  await navigator.clipboard.writeText(new URL("/s/" + id + ".svg", location.href).href);
  copy.textContent = "Copied";
  setTimeout(() => { copy.textContent = "Copy link"; }, 2000);
});

load().then((state) => (state.busy ? watch() : undefined));
`;

/** A session: the animation as large as the window allows, its progress while the agent works, then a bar to change it. */
export const studio = (id: string) =>
  layout(
    "svjeez agent",
    html`<header class="top"><a class="name" href="/">svjeez agent</a></header>
<main class="work" data-id="${id}">
  <figure class="stage"><img id="scene" alt="The animation" hidden><p id="live" class="live" aria-live="polite"></p></figure>
  <details id="steps" class="steps" hidden><summary>Steps</summary><ol></ol></details>
  <p id="summary" class="summary"></p>
  <div id="bar" class="bar">
    <form id="change" class="change">
      <label class="visually-hidden" for="text">Ask for a change</label>
      <textarea id="text" rows="1" maxlength="${LIMITS.message}" required placeholder="Ask for a change"></textarea>
      <button class="primary">Send</button>
    </form>
    <p id="error" class="error" role="alert"></p>
    <div class="tools">
      <button type="button" id="undo">Undo</button>
      <button type="button" id="copy" data-scene>Copy link</button>
      <a class="button" href="/s/${id}.svg" download="scene.svg" data-scene>Download SVG</a>
      <a class="button" href="/s/${id}.tsx" target="_blank" data-scene>View source</a>
    </div>
  </div>
</main>`,
    SCRIPT,
  );
