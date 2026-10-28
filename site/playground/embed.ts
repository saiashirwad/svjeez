/**
 * Embed contract. Load this one small script and mark a container:
 *
 *   <div data-playground="toast"></div>
 *   <script type="module" src="/playground/embed.js"></script>
 *
 * data-playground    first example: curve, toast, orbit, flowchart, explainer or adaptive.
 * data-examples      optional comma list that limits the tabs, e.g. "toast,orbit".
 * data-eager         optional. Load now instead of near the viewport or on click (the /play page uses it).
 *
 * This file holds only the loader and the stylesheet. app.js (editor), worker.js (transpiler and library)
 * load when the container comes within 600px of the viewport, or when its button is pressed.
 * Style it from outside with --pg-* custom properties (see playground.css). It reads --bg, --ink and --accent when the page sets them.
 */
import css from "./playground.css" with { type: "text" };

const appUrl = new URL(APP_FILE, import.meta.url).href;

if (!document.getElementById("pg-css")) {
  const style = document.createElement("style");
  style.id = "pg-css";
  style.textContent = css;
  document.head.prepend(style);
}

const load = async (host: HTMLElement) => {
  if (host.dataset.state !== "idle") return;
  host.dataset.state = "loading";
  const label = host.querySelector(".pg-load");
  if (label) label.textContent = "Loading the editor";
  try {
    const { mount } = await import(/* @vite-ignore */ appUrl);
    mount(host, host.dataset.playground ?? "", host.dataset.examples?.split(",").map((id) => id.trim()));
  } catch {
    host.dataset.state = "idle";
    if (label) label.textContent = "Could not load the editor. Try again";
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      load(entry.target as HTMLElement);
    }
  },
  { rootMargin: "600px 0px" },
);

for (const host of document.querySelectorAll<HTMLElement>("[data-playground]")) {
  host.classList.add("pg");
  host.dataset.state = "idle";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "pg-load";
  button.textContent = "Edit this scene";
  button.addEventListener("click", () => load(host));
  host.replaceChildren(button);
  if ("eager" in host.dataset) load(host);
  else observer.observe(host);
}
