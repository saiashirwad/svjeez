<!--
  The scene's picture with a grip on it for each number param: drag a grip, or focus it and press the arrow keys
  (Shift for ten steps). A grip says what it holds while it is held or focused. Reads the page's --radius, --ring,
  --shadow, --accent, --mono and --out.
-->
<script lang="ts">
  import type { Attachment } from "svelte/attachments";
  import { on } from "svelte/events";
  import { follow, type Schema } from "svjeez/params";
  import type { Grip, Live } from "./live.svelte";

  let { scene }: { scene: Pick<Live<Schema>, "first" | "grips" | "src" | "active"> } = $props();

  /** A drag carries the value as far as it carries the handle, along the way the handle travels. */
  const drag =
    (grip: Grip): Attachment<HTMLElement> =>
    (handle) => {
      let raw = 0;
      let scale = 1;
      let last = { x: 0, y: 0 };

      const offs = [
        on(handle, "pointerdown", (e) => {
          // No text selection or native drag starts under the pointer, which would cancel this one.
          e.preventDefault();
          handle.focus();
          handle.setPointerCapture(e.pointerId);
          raw = grip.value;
          // The picture keeps its size for the drag, so measure it once rather than on every move.
          scale = scene.first.width / handle.parentElement!.clientWidth;
          last = { x: e.clientX, y: e.clientY };
        }),
        on(handle, "pointermove", (e) => {
          if (!handle.hasPointerCapture(e.pointerId)) return;
          const by = { x: (e.clientX - last.x) * scale, y: (e.clientY - last.y) * scale };
          last = { x: e.clientX, y: e.clientY };
          raw = follow(grip.param, (v) => grip.along(v)!, raw, by);
          grip.set(raw);
        }),
      ];

      return () => offs.forEach((off) => off());
    };

  const ARROWS = new Map([
    ["ArrowRight", 1],
    ["ArrowUp", 1],
    ["ArrowLeft", -1],
    ["ArrowDown", -1],
  ]);

  const nudge = (grip: Grip) => (e: KeyboardEvent) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    grip.set(grip.value + by * grip.param.step * (e.shiftKey ? 10 : 1));
  };
</script>

<figure class="picture">
  <img
    src={scene.src}
    alt={scene.first.title}
    width={scene.first.width}
    height={scene.first.height}
  />
  {#each scene.grips as grip (grip.key)}
    {@const at = grip.at}
    {#if at}
      <div
        class="grip"
        role="slider"
        tabindex="0"
        aria-label={grip.key}
        aria-valuemin={grip.param.min}
        aria-valuemax={grip.param.max}
        aria-valuenow={grip.value}
        data-value="{grip.key} {grip.value}{grip.param.unit ?? ''}"
        style:left="{(at.x / scene.first.width) * 100}%"
        style:top="{(at.y / scene.first.height) * 100}%"
        onkeydown={nudge(grip)}
        onfocus={() => (scene.active = grip.key)}
        onblur={() => (scene.active = null)}
        {@attach drag(grip)}
      ></div>
    {/if}
  {/each}
</figure>

<style>
  .picture {
    position: relative;
    user-select: none;
    margin: 0;
    border-radius: var(--radius);
    overflow: clip;
    box-shadow:
      0 0 0 1px var(--ring),
      0 1.25rem 2.5rem -1.25rem var(--shadow);
  }
  img {
    display: block;
    inline-size: 100%;
    block-size: auto;
  }

  .grip {
    position: absolute;
    inline-size: 2rem;
    block-size: 2rem;
    translate: -50% -50%;
    border-radius: 50%;
    cursor: grab;
    touch-action: none;
    outline: none;
  }
  .grip:active {
    cursor: grabbing;
  }
  .grip::before {
    content: "";
    position: absolute;
    inset: 0.5625rem;
    border-radius: 50%;
    background: oklch(20% 0.02 300 / 0.6);
    box-shadow:
      inset 0 0 0 2px oklch(97% 0.01 300),
      0 0 0 4px oklch(97% 0.01 300 / 0);
    transition:
      scale 0.15s var(--out),
      box-shadow 0.15s var(--out);
  }
  .grip:hover::before,
  .grip:focus-visible::before,
  .grip:active::before {
    scale: 1.25;
    box-shadow:
      inset 0 0 0 2px oklch(97% 0.01 300),
      0 0 0 4px oklch(97% 0.01 300 / 0.22);
  }
  .grip:focus-visible::before {
    box-shadow:
      inset 0 0 0 2px oklch(97% 0.01 300),
      0 0 0 3px var(--accent);
  }

  /* While a handle is held or focused, it says what it holds. */
  .grip::after {
    content: attr(data-value);
    position: absolute;
    inset-block-end: calc(100% + 0.125rem);
    inset-inline-start: 50%;
    translate: -50% 0.25rem;
    padding: 0.2rem 0.45rem;
    border-radius: 0.375rem;
    background: oklch(97% 0.01 300);
    color: oklch(22% 0.02 300);
    font: 500 0.72rem/1 var(--mono);
    white-space: nowrap;
    pointer-events: none;
    opacity: 0;
    transition:
      opacity 0.15s var(--out),
      translate 0.15s var(--out);
  }
  .grip:focus-visible::after,
  .grip:active::after {
    opacity: 1;
    translate: -50% 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .grip::before,
    .grip::after {
      transition: none;
    }
  }
</style>
