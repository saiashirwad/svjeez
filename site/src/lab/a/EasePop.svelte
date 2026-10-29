<script lang="ts">
  import { easeText } from "@svjeez/live/source";
  import { ease } from "svjeez";
  import { bez, curvePath } from "./curves";
  import { getLab, type EaseEditor } from "./lab.svelte";

  let { editor }: { editor: EaseEditor } = $props();
  const lab = getLab();

  // Two handles, the curve, a dot riding it, and a ball that moves with only the eased value.
  const W = 200;
  const H = 240;
  const X = (u: number) => 20 + u * (W - 60);
  const Y = (v: number) => 195 - v * 85;
  const UX = (x: number) => (x - 20) / (W - 60);
  const UY = (y: number) => (195 - y) / 85;

  const p = $derived(editor.get());
  const curve = $derived(bez(p));
  const eased = $derived(Y(curve(lab.ride)));

  let pop: HTMLDivElement;
  let svg: SVGSVGElement;
  let held: number | null = null;

  const grab = (e: PointerEvent, which: number) => {
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    held = which;
    lab.holdEase(true);
  };

  const move = (e: PointerEvent) => {
    if (held === null) return;
    const b = svg.getBoundingClientRect();
    const x = ((e.clientX - b.left) / b.width) * W;
    const y = ((e.clientY - b.top) / b.height) * H;
    const next = [...p];
    next[held * 2] = Math.round(Math.max(0, Math.min(1, UX(x))) * 100) / 100;
    next[held * 2 + 1] = Math.round(Math.max(-0.8, Math.min(2.2, UY(y))) * 100) / 100;
    editor.set(next);
  };

  const up = () => {
    if (held === null) return;
    held = null;
    lab.holdEase(false);
  };

  const outside = (e: PointerEvent) => {
    const inside =
      e.target instanceof Node && (pop.contains(e.target) || editor.anchor.contains(e.target));

    if (!inside) lab.closeEase();
  };
</script>

<svelte:document
  onpointerdown={outside}
  onkeydown={(e) => {
    if (e.key === "Escape") lab.closeEase();
  }}
/>

<div class="la-ease-pop" bind:this={pop} style:left="{editor.left}px" style:top="{editor.top}px">
  <svg
    bind:this={svg}
    viewBox="0 0 {W} {H}"
    role="presentation"
    onpointermove={move}
    onpointerup={up}
  >
    <rect x={X(0)} y={Y(1)} width={X(1) - X(0)} height={Y(0) - Y(1)} class="e-box" />
    <line x1={X(0)} y1={Y(0)} x2={X(p[0]!)} y2={Y(p[1]!)} class="e-arm" />
    <line x1={X(1)} y1={Y(1)} x2={X(p[2]!)} y2={Y(p[3]!)} class="e-arm" />
    <path d={curvePath(p, X, Y)} class="e-curve" />
    <line x1={W - 22} y1={Y(0)} x2={W - 22} y2={Y(1)} class="e-lane" />
    <circle class="e-ride" r="4" cx={X(lab.ride)} cy={eased} />
    <circle class="e-ball" cx={W - 22} cy={eased} r="6" />
    {#each [0, 1] as which (which)}
      <circle
        class="e-handle"
        role="presentation"
        cx={X(p[which * 2]!)}
        cy={Y(p[which * 2 + 1]!)}
        r="7"
        onpointerdown={(e) => grab(e, which)}
      />
    {/each}
    {#if p[1]! > 1 || p[3]! > 1}
      <text x={X(0.5)} y={Y(1) - 34} class="e-note">overshoot</text>
    {/if}
  </svg>
  <code class="la-ease-text">{easeText(ease.bezier(p[0]!, p[1]!, p[2]!, p[3]!))}</code>
</div>

<style>
  .la-ease-pop {
    position: absolute;
    z-index: 10;
    inline-size: 200px;
    padding: 0.5rem 0.5rem 0.65rem;
    border-radius: 0.85rem;
    background: var(--win-bg);
    box-shadow:
      0 0 0 1px var(--ring),
      0 1.5rem 3rem -1rem var(--shadow);
  }
  .la-ease-pop svg {
    display: block;
    inline-size: 100%;
    block-size: auto;
    touch-action: none;
    overflow: visible;
  }
  .la-ease-pop code {
    display: block;
    margin-block-start: 0.25rem;
    text-align: center;
    font-size: 0.72rem;
    color: var(--code-fn);
  }
  .e-box {
    fill: var(--surface);
    stroke: var(--line);
  }
  .e-arm {
    stroke: var(--muted);
    stroke-width: 1;
    stroke-dasharray: 3 3;
  }
  .e-curve {
    fill: none;
    stroke: var(--code-fn);
    stroke-width: 3;
    stroke-linecap: round;
  }
  .e-lane {
    stroke: var(--line);
    stroke-width: 2;
  }
  .e-ride {
    fill: var(--code-tag);
  }
  .e-ball {
    fill: var(--code-number);
  }
  .e-handle {
    fill: var(--win-bg);
    stroke: var(--code-fn);
    stroke-width: 2.5;
    cursor: grab;
  }
  .e-handle:active {
    cursor: grabbing;
    fill: var(--code-fn);
  }
  .e-note {
    font: 600 10px var(--mono);
    fill: var(--code-tag);
    text-anchor: middle;
  }
</style>
