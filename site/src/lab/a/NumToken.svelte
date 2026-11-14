<script lang="ts">
  import { fit } from "svjeez/params";
  import { paramFor } from "@svjeez/live/controls";
  import { write, type LiteralOf } from "@svjeez/live/source";
  import { flushSync } from "svelte";
  import { getLab } from "./lab.svelte";
  import { params } from "./meadow";

  let { literal }: { literal: LiteralOf<"number"> } = $props();
  const lab = getLab();

  let text = $derived(literal.text);
  const param = $derived(paramFor(literal, params));

  let el: HTMLSpanElement;
  let held: { v0: number; x0: number } | null = $state.raw(null);

  const set = (v: number) => {
    const next = write({ ...literal, value: v }, 6);

    if (next === text) return;
    lab.edit(literal.range[0], text.length, next);
    // The HUD centers on the new text, so it must be on the page first.
    flushSync(() => (text = next));
    lab.showHud(el, param, v);
  };

  const down = (e: PointerEvent & { currentTarget: HTMLSpanElement }) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    held = { v0: Number(text), x0: e.clientX };
    lab.grab();
  };

  const move = (e: PointerEvent) => {
    if (!held) return;
    const fine = e.shiftKey ? 0.2 : 1;
    set(fit(param, held.v0 + (((e.clientX - held.x0) * (param.max - param.min)) / 260) * fine));
  };

  const up = () => {
    if (!held) return;
    held = null;
    lab.release();
  };

  const key = (e: KeyboardEvent) => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    set(fit(param, Number(text) + (e.key === "ArrowUp" ? 1 : -1) * param.step));
    lab.commit();
  };
</script>

<span
  bind:this={el}
  class={["c-num", "la-scrub", { "is-dragging": held }]}
  tabindex="0"
  role="slider"
  aria-label={param.label || "number"}
  aria-valuemin={param.min}
  aria-valuemax={param.max}
  aria-valuenow={Number(text)}
  title={param.label ? `${param.label}: drag sideways` : "drag sideways"}
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onkeydown={key}
  onblur={() => lab.hideHud()}>{text}</span
>

<style>
  .la-scrub {
    cursor: ew-resize;
    border-radius: 0.25em;
    text-decoration: underline dotted 1.5px;
    text-underline-offset: 0.3em;
    touch-action: pan-y;
    user-select: none;
    -webkit-user-select: none;
  }
  .la-scrub.is-dragging {
    background: color-mix(in oklch, var(--la-num) 22%, transparent);
    box-shadow: 0 0 0 2px color-mix(in oklch, var(--la-num) 22%, transparent);
    text-decoration-style: solid;
  }
  @media (hover: hover) and (pointer: fine) {
    .la-scrub:hover {
      background: color-mix(in oklch, var(--la-num) 14%, transparent);
    }
  }
  :global(.has-error) .la-scrub.is-dragging {
    color: var(--code-tag);
    text-decoration: wavy underline 1px;
  }
</style>
