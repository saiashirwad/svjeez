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
