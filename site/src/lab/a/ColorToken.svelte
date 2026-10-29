<script lang="ts">
  import { hexToHsl, hslToHex } from "./curves";
  import { getLab } from "./lab.svelte";
  import { write, type LiteralOf } from "@svjeez/live/source";
  import type { Hex } from "svjeez";

  let { literal }: { literal: LiteralOf<"color"> } = $props();
  const lab = getLab();

  let hex = $derived(literal.value);
  let picker: HTMLInputElement;

  /** The color and pointer at the press, and whether the pointer has moved far enough to count as a drag. */
  let held: { from: Hex; x0: number; y0: number; moved: boolean } | null = $state.raw(null);

  const set = (next: Hex) => {
    lab.edit(literal.range[0], hex.length + 2, write({ ...literal, value: next }));
    hex = next;
  };

  const down = (e: PointerEvent & { currentTarget: HTMLSpanElement }) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    held = { from: hex, x0: e.clientX, y0: e.clientY, moved: false };
    lab.grab();
  };

  const move = (e: PointerEvent) => {
    if (!held) return;
    const dx = e.clientX - held.x0;
    const dy = e.clientY - held.y0;

    if (!held.moved && Math.abs(dx) + Math.abs(dy) <= 3) return;
    held = { ...held, moved: true };
    const [h, s, l] = hexToHsl(held.from);
    set(
      hslToHex(
        (((h + dx * 1.2) % 360) + 360) % 360,
        Math.max(0.35, s),
        Math.max(0.08, Math.min(0.92, l - dy / 300)),
      ),
    );
  };

  const up = () => {
    if (!held) return;
    const clicked = !held.moved;
    held = null;

    if (clicked) {
      picker.value = hex.toLowerCase();
      picker.click();
    }

    lab.release();
  };
</script>

<span class="la-colorwrap"
  ><span
    class={["la-swatch", { "is-dragging": held }]}
    style:--c={hex}
    tabindex="0"
    role="button"
    aria-label="Change this color"
    title="drag: sideways for hue, up and down for light. Click to pick."
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={up}
  ></span><span class="c-string">"{hex}"</span><input
    bind:this={picker}
    class="la-color-input"
    type="color"
    tabindex="-1"
    aria-hidden="true"
    oninput={(e) => set(`#${e.currentTarget.value.slice(1).toUpperCase()}`)}
    onchange={() => lab.commit()}
  /></span
>

<style>
  .la-colorwrap {
    white-space: nowrap;
  }
  .la-swatch {
    display: inline-block;
    inline-size: 0.95em;
    block-size: 0.95em;
    margin-inline-end: 0.35em;
    vertical-align: -0.12em;
    border-radius: 0.25em;
    background: var(--c);
    box-shadow:
      0 0 0 1px color-mix(in oklch, var(--ink) 18%, transparent),
      inset 0 0 0 1px oklch(100% none none / 0.25);
    cursor: grab;
    touch-action: none;
  }
  .la-swatch.is-dragging {
    cursor: grabbing;
    scale: 1.35;
  }
  @media (prefers-reduced-motion: no-preference) {
    .la-swatch {
      transition: scale 160ms var(--out);
    }
  }
  @media (hover: hover) and (pointer: fine) {
    .la-swatch:hover {
      scale: 1.2;
    }
  }
  .la-color-input {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    opacity: 0;
    pointer-events: none;
    inset: 0 auto auto 0;
  }
</style>
