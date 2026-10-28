const root = document.documentElement;
const store = (key, value) => {
  try {
    return value === undefined ? localStorage.getItem(key) : localStorage.setItem(key, value);
  } catch {}
};

// Theme: the toggle sets `color-scheme` on the page, and Chromium hands that to every <img> SVG on it.
document.querySelector(".theme")?.addEventListener("click", () => {
  const dark = getComputedStyle(root).colorScheme === "dark";
  const next = dark ? "light" : "dark";
  root.dataset.theme = next;
  store("theme", next);
});

// Install command.
document.querySelector(".install button")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    button.setAttribute("aria-label", "Copied");
    button.title = "Copied";
    setTimeout(() => (button.title = button.ariaLabel = "Copy the install command"), 1500);
  } catch {}
});

// Light and dark, side by side: one SVG file in two <img>s, one of them told to be dark.
const stage = document.querySelector(".stage");
if (stage) {
  const range = stage.querySelector("input");
  const set = (percent) => {
    const value = Math.min(100, Math.max(0, percent));
    stage.style.setProperty("--split", `${value}%`);
    range.value = String(Math.round(value));
  };
  const at = (event) => set(((event.clientX - stage.getBoundingClientRect().left) / stage.offsetWidth) * 100);
  const stop = () => stage.classList.remove("intro");
  stage.addEventListener("pointerdown", (event) => {
    stop();
    stage.setPointerCapture(event.pointerId);
    at(event);
    stage.onpointermove = at;
  });
  stage.addEventListener("pointerup", () => (stage.onpointermove = null));
  range.addEventListener("input", () => {
    stop();
    stage.style.setProperty("--split", `${range.value}%`);
  });
  document.querySelectorAll("[data-split]").forEach((button) => button.addEventListener("click", () => (stop(), set(Number(button.dataset.split)))));
}

// Gallery: a card shows a still until you hover it (or, on a touch screen, until it is mostly in view).
// Only then does its SVG download, and it goes back to the still when you leave.
const shots = document.querySelectorAll(".shot[data-live]");
const play = (shot) => {
  if (shot.dataset.playing) return;
  const image = shot.querySelector("img");
  const live = new Image();
  live.onload = () => {
    if (shot.dataset.want !== "1") return;
    image.src = shot.dataset.live;
    shot.dataset.playing = "1";
  };
  shot.dataset.want = "1";
  live.src = shot.dataset.live;
};
const rest = (shot) => {
  shot.dataset.want = "0";
  if (!shot.dataset.playing) return;
  shot.querySelector("img").src = shot.dataset.still;
  delete shot.dataset.playing;
};
if (shots.length) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    let timer;
    for (const shot of shots) {
      const card = shot.closest("a");
      card.addEventListener("pointerenter", () => (timer = setTimeout(() => play(shot), 150)));
      card.addEventListener("pointerleave", () => (clearTimeout(timer), rest(shot)));
      card.addEventListener("focus", () => play(shot));
      card.addEventListener("blur", () => rest(shot));
    }
  } else {
    const seen = new IntersectionObserver((entries) => entries.forEach((entry) => (entry.isIntersecting ? play : rest)(entry.target)), { threshold: 0.75 });
    shots.forEach((shot) => seen.observe(shot));
  }
}

// Stills load once they come within 250px of the viewport.
const stills = document.querySelectorAll("img[data-src]");
if (stills.length) {
  const near = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.src = entry.target.dataset.src;
        near.unobserve(entry.target);
      }),
    { rootMargin: "250px 0px" },
  );
  stills.forEach((image) => near.observe(image));
}
