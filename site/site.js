const root = document.documentElement;
const store = (key, value) => {
  try {
    return value === undefined ? localStorage.getItem(key) : localStorage.setItem(key, value);
  } catch {}
};
const dark = matchMedia("(prefers-color-scheme: dark)");
const calm = matchMedia("(prefers-reduced-motion: reduce)");
/** The scheme the page shows: the toggle's choice, else the system's. An <img> SVG follows the same one. */
const scheme = () => root.dataset.theme || (dark.matches ? "dark" : "light");

// Scenes: every one is an <img>. Off screen it is a still; it plays only while it is on screen, and goes back to its still when it leaves.
// A scene near the viewport gets its still first, so scrolling never meets an empty box.
// A scene plays once this much of it is on screen, so a screen full of half-cut cards does not animate them all.
const SHOWN = 0.3;
// Main-thread milliseconds per second each scene costs while it plays, measured in headless Chromium at 1440 wide.
// Scenes play while their total stays inside BUDGET, so a screen of busy windows never costs more than that.
const BUDGET = 80;
const COST = { mark: 3, matrix: 24, hero: 55, "hero-tall": 55, "timeline-tall": 30, "pipeline-tall": 30, "agents-tall": 40, "nojsx-tall": 30, timeline: 41, pipeline: 44, agents: 52, nojsx: 45, explainer: 23, recording: 28, ink: 17, fonts: 20, handshake: 11, team: 32, daynight: 30, "where-readme": 8, "where-docs": 4, "where-mail": 4, toast: 6 };
const scenes = document.querySelectorAll(".scene[data-scene]");
const posterOf = (img) => `/s/poster/${img.dataset.scene}-${img.dataset.scheme || scheme()}.webp`;
const liveOf = (img) => `/s/${img.dataset.scene}.svg`;
const still = (img) => {
  img.dataset.want = "still";
  img.dataset.state = "still";
  img.src = posterOf(img);
};
const play = (img) => {
  if (calm.matches) return img.dataset.state === "still" ? undefined : still(img);
  if (img.dataset.state === "live") return;
  img.dataset.want = "live";
  const probe = new Image();
  probe.src = liveOf(img);
  probe.decode().catch(() => {}).then(() => {
    if (img.dataset.want !== "live") return;
    img.src = liveOf(img);
    img.dataset.state = "live";
  });
};
if (scenes.length) {
  const near = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        const img = entry.target;
        if (entry.isIntersecting && !img.dataset.want) still(img);
      }),
    { rootMargin: "500px 0px" },
  );
  // The scenes most on screen, nearest the middle of it, play first. The rest wait as stills.
  const ratio = new Map();
  const balance = () => {
    const middle = innerHeight / 2;
    const reach = (img) => {
      const box = img.getBoundingClientRect();
      return Math.abs(box.top + box.height / 2 - middle);
    };
    let spent = 0;
    const wanted = new Set(
      [...ratio]
        .filter(([, r]) => r >= SHOWN)
        .map(([img]) => img)
        .sort((a, b) => ratio.get(b) - ratio.get(a) || reach(a) - reach(b))
        .filter((img) => (spent + (COST[img.dataset.scene] ?? 30) <= BUDGET ? ((spent += COST[img.dataset.scene] ?? 30), true) : false)),
    );
    scenes.forEach((img) => {
      if ("manual" in img.dataset) return;
      if (wanted.has(img)) play(img);
      else if (img.dataset.state === "live") still(img);
    });
  };
  const view = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => ratio.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0));
      balance();
    },
    { threshold: [0, 0.15, SHOWN, 0.5, 0.75, 1] },
  );
  scenes.forEach((img) => {
    near.observe(img);
    if (!("manual" in img.dataset)) view.observe(img);
  });
  const refresh = () => scenes.forEach((img) => img.dataset.state === "still" && still(img));
  calm.addEventListener("change", () => scenes.forEach((img) => (img.dataset.state === "live" && calm.matches ? still(img) : undefined)));
  addEventListener("themechange", refresh);
}

// Theme: the toggle sets `color-scheme` on the page, and Chromium hands that to every <img> SVG on it.
document.querySelector(".theme")?.addEventListener("click", () => {
  const next = scheme() === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  store("theme", next);
  dispatchEvent(new Event("themechange"));
});

// Install command.
document.querySelector("[data-copy]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const label = button.parentElement.querySelector("code");
  const before = label.innerHTML;
  try {
    await navigator.clipboard.writeText(button.dataset.copy);
    label.textContent = "Copied";
    setTimeout(() => (label.innerHTML = before), 1400);
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
  // This one scene costs two images' worth, so it plays only while you point at it (or touch it), and rests as a still otherwise.
  const pair = [...stage.querySelectorAll(".scene")];
  const start = () => {
    pair.forEach(play);
    stage.classList.add("playing");
  };
  const rest = () => {
    pair.forEach(still);
    stage.classList.remove("playing");
  };
  stage.addEventListener("pointerenter", start);
  stage.addEventListener("pointerleave", (event) => event.pointerType === "mouse" && rest());
  new IntersectionObserver((entries) => entries.forEach((entry) => !entry.isIntersecting && rest())).observe(stage);
  range.addEventListener("input", () => {
    stop();
    stage.style.setProperty("--split", `${range.value}%`);
  });
}

// Gallery: a card shows a still until you hover it (or, on a touch screen, until it is mostly in view).
// Only then does its SVG download, and it goes back to the still when you leave.
const stillOf = (shot) => `${shot.dataset.still}-${scheme()}.webp`;
const shots = document.querySelectorAll(".shot[data-live]");
const run = (shot) => {
  if (shot.dataset.playing || calm.matches) return;
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
  shot.querySelector("img").src = stillOf(shot);
  delete shot.dataset.playing;
};
if (shots.length) {
  const fine = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fine) {
    let timer;
    for (const shot of shots) {
      const card = shot.closest("a");
      card.addEventListener("pointerenter", () => (timer = setTimeout(() => run(shot), 150)));
      card.addEventListener("pointerleave", () => (clearTimeout(timer), rest(shot)));
      card.addEventListener("focus", () => run(shot));
      card.addEventListener("blur", () => rest(shot));
    }
  } else {
    const seen = new IntersectionObserver((entries) => entries.forEach((entry) => (entry.isIntersecting ? run : rest)(entry.target)), { threshold: 0.75 });
    shots.forEach((shot) => seen.observe(shot));
  }
  const near = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const shot = entry.target.closest(".shot");
        entry.target.src = stillOf(shot);
        near.unobserve(entry.target);
      }),
    { rootMargin: "250px 0px" },
  );
  document.querySelectorAll(".shot img[data-src]").forEach((image) => near.observe(image));
  addEventListener("themechange", () => shots.forEach((shot) => !shot.dataset.playing && shot.querySelector("img").src && (shot.querySelector("img").src = stillOf(shot))));
}
