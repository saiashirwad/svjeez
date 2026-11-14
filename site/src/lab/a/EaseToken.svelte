<script lang="ts">
  import { write, type LiteralOf } from "@svjeez/live/source";
  import { ease } from "svjeez";
  import { bez, curvePath, fmt } from "./curves";
  import { getLab } from "./lab.svelte";
  import { easePoints } from "../util";

  let { literal }: { literal: LiteralOf<"ease"> } = $props();
  const lab = getLab();

  let text = $derived(literal.text);
  let points: readonly number[] = $derived(easePoints(literal.value));

  /** A named ease turns into `ease.bezier(…)` at its first edit. */
  let name = $derived(literal.name);
  const curve = $derived(bez(points));

  const SEP = ", ";
  const X = (u: number) => u * 24;
  const Y = (v: number) => 18 - v * 18;

  let glyph: SVGSVGElement;

  const set = (p: number[]) => {
    const next = write({ ...literal, value: ease.bezier(p[0]!, p[1]!, p[2]!, p[3]!) });
    lab.edit(literal.range[0], text.length, next);
    points = p;
    text = next;
    name = "bezier";
  };

  const open = () => lab.openEase(glyph, () => points, set);
</script>

<span class="la-easewrap"
  ><svg
    bind:this={glyph}
    viewBox="-2 -8 28 28"
    class="la-glyph"
    tabindex="0"
    role="button"
    aria-label="Bend this ease"
    onclick={open}
    onkeydown={(e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      open();
    }}
    ><rect x="0" y="0" width="24" height="18" rx="2" class="g-box" /><path
      class="g-curve"
      d={curvePath(points, X, Y)}
    /><circle class="g-dot" r="2.2" cx={X(lab.ride)} cy={Y(curve(lab.ride))} /></svg
  ><span class="c-ease"
    ><span class="c-plain">ease.</span><span class="c-fn">{name}</span
    >{#if name === "bezier"}<span class="c-punct">(</span>{#each [0, 1, 2, 3] as i (i)}{#if i}<span class="c-punct">{SEP}</span>{/if}<span class="c-num">{fmt(points[i]!, 2)}</span>{/each}<span class="c-punct">)</span
      >{/if}</span
  ></span
>

<style>
  .la-easewrap {
    white-space: nowrap;
  }
  .la-glyph {
    display: inline-block;
    inline-size: 1.75em;
    block-size: 1.4em;
    margin-inline-end: 0.3em;
    vertical-align: -0.38em;
    overflow: visible;
    cursor: pointer;
    border-radius: 0.25em;
  }
  .g-box {
    fill: color-mix(in oklch, var(--code-fn) 10%, transparent);
    stroke: color-mix(in oklch, var(--code-fn) 30%, transparent);
    stroke-width: 1;
  }
  .g-curve {
    fill: none;
    stroke: var(--code-fn);
    stroke-width: 2;
    stroke-linecap: round;
  }
  .g-dot {
    fill: var(--code-tag);
  }
  .la-glyph:active {
    transform: scale(0.95);
  }
  @media (hover: hover) and (pointer: fine) {
    .la-glyph:hover .g-box {
      fill: color-mix(in oklch, var(--code-fn) 22%, transparent);
    }
  }
</style>
