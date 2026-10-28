/**
 * Upgrades every [data-playground] container on the page.
 *
 * data-playground    first example: curve, toast, orbit, flowchart, explainer or adaptive.
 * data-examples      optional comma list that limits the tabs, e.g. "toast,orbit".
 * data-eager         optional. Load now instead of near the viewport or on click (the /play page uses it).
 *
 * This module holds only the loader. The editor and the worker (transpiler and library) load when the container
 * comes within 600px of the viewport, or when its button is pressed.
 * Style it from outside with --pg-* custom properties (see playground.css). It reads --bg, --ink and --accent when the page sets them.
 */
import "./playground.css";

const load = async (host: HTMLElement) => {
  if (host.dataset.state !== "idle") return;
  host.dataset.state = "loading";
  const label = host.querySelector(".pg-load");

  if (label) label.textContent = "Loading the editor";

  try {
    const { mount } = await import("./app");
    mount(
      host,
      host.dataset.playground ?? "",
      host.dataset.examples?.split(",").map((id) => id.trim()),
    );
  } catch {
    host.dataset.state = "idle";

    if (label) label.textContent = "Could not load the editor. Try again";
  }
};

const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting || !(entry.target instanceof HTMLElement)) continue;
      observer.unobserve(entry.target);
      load(entry.target);
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
