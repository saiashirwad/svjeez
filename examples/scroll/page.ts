// Prints the demo page: a scene whose camera follows the scroll through a CSS scroll timeline, while the mechanism it
// shows keeps running on the clock. No script drives it.
import { restyle } from "svjeez/page";
import escapement, { D, GROUND, moments } from "../escapement/index.tsx";

const svg = restyle(escapement({ prefix: "w" }), { timeline: "--watch", range: "contain" });

/** Pinned for this many viewport heights: about 20 for each second of the camera's tour. */
const LENGTH = 1300;

const words: Record<keyof typeof moments, string> = {
  wide: "The going train of a mechanical watch, slowed down. A coiled spring at one end, a swinging wheel at the other.",
  barrel:
    "The mainspring sits in the barrel. Its 54 teeth drive a pinion of 36 on the centre wheel.",
  train:
    "Each wheel drives a small pinion on the next, so each turns faster: 1.5 times, 1.5, 2 and 2 here, where a real watch gears up 6, 8, 7.5 and 10 times. The force falls by the same factors.",
  escapement:
    "The escape wheel has 15 teeth and would spin freely, but two rubies on the fork stand in its way.",
  pin: "Each time the balance passes the middle, the pin under it catches the fork and throws it across to the other banking pin.",
  stones:
    "That pulls one stone clear. The freed tooth slides along the stone's slanted end, which pushes the fork and the balance on, then drops. The other stone stops the next tooth 12° later. That stop is the tick.",
  all: "18,000 beats an hour, 432,000 a day.",
};

// Each caption holds for its span of the scene, on the same timeline: its range is the span as a share of the scroll.
const share = (seconds: number) => ((seconds / D) * 100).toFixed(2) + "%";

// SAFETY: `moments` is a plain object literal, so its keys are exactly its own named keys.
const captions = (Object.keys(moments) as (keyof typeof moments)[])
  .map(
    (key) =>
      '<p style="animation-range: contain ' +
      share(moments[key][0]) +
      " contain " +
      share(moments[key][1]) +
      '">' +
      words[key] +
      "</p>",
  )
  .join("\n");

const html = String.raw`<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>One beat of a watch</title>
<style>
  :root { color-scheme: dark; --bg: ${GROUND}; --fg: #ECE9E2; --dim: #96928A; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 18px/1.5 system-ui, -apple-system, "Helvetica Neue", sans-serif; }
  header, footer { min-height: 60vh; display: grid; place-content: center; padding: 0 1.5rem; }
  h1 { font-size: clamp(2rem, 5vw, 3.25rem); font-weight: 600; margin: 0 0 .6rem; letter-spacing: -0.02em; }
  header p, footer p { color: var(--dim); max-width: 36ch; margin: 0; }
  #watch svg { display: block; width: 100%; max-width: 100vh; margin: 0 auto; }
  .words { max-width: 36ch; margin: 0 auto; padding: 1rem 1.5rem; }

  /* With scroll timelines the scene is pinned, and the words change beside it. Without them it plays above a list. */
  @supports (animation-timeline: scroll()) {
    @media (prefers-reduced-motion: no-preference) {
      #watch { height: ${LENGTH}vh; view-timeline: --watch block; }
      .stage { position: sticky; top: 0; height: 100vh; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1fr) 21rem; align-items: center; }
      .stage svg { height: 100vh; max-width: none; }
      .words { display: grid; margin: 0; padding: 0 2.5rem 0 0; }
      .words p { grid-area: 1 / 1; align-self: center; margin: 0; text-wrap: pretty; opacity: 0; animation: word linear both; animation-timeline: --watch; }
      @media (max-width: 860px) {
        .stage { grid-template-columns: none; grid-template-rows: 100vw 1fr; align-items: start; box-sizing: border-box; padding-top: max(0px, (100vh - 100vw - 10rem) / 2); }
        .stage svg { height: 100vw; }
        .words { padding: 1rem 1.25rem 0; font-size: 16px; }
        .words p { align-self: start; }
      }
    }
  }
  @keyframes word { 0% { opacity: 0 } 14%, 86% { opacity: 1 } 100% { opacity: 0 } }
</style>
<header>
  <div>
    <h1>One beat of a watch</h1>
    <p>A going train and lever escapement, built for 18,000 beats an hour and shown at a tenth of that.</p>
  </div>
</header>
<section id="watch">
  <div class="stage">
    ${svg}
    <div class="words">
${captions}
    </div>
  </div>
</section>
<footer>
  <p>Tooth counts and rates are those of a common 18,000 train. The escape wheel's angle is found from the shapes of its teeth and the two stones.</p>
</footer>
`;

console.log(html);
