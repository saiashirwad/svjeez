<script lang="ts">
  import { apply, paramLiteral, parse, write } from "@svjeez/live/source";
  import type { Attachment } from "svelte/attachments";
  import { on } from "svelte/events";
  import { defaults, fit, follow } from "svjeez/params";
  import { createCompiler, latestWins } from "../compiler";
  import { svgUrl } from "../util";
  import Code from "./Code.svelte";
  import { handles, params } from "./pendulum";
  import text from "./pendulum.tsx?raw";
  import first from "./pendulum.tsx?svjeez";

  type Key = keyof typeof params;

  // SAFETY: Object.keys of the params object lists exactly its keys.
  const keys = Object.keys(params) as Key[];

  /** Where the file declares each value, found once in the file as written. */
  const literals = keys.map((key) => {
    const literal = paramLiteral(parse(text), key);

    if (literal?.kind !== "number") throw new Error(`params.${key} is not declared with a number.`);

    return { key, literal };
  });

  let values = $state.raw(defaults(params));

  /** The file with each value written where it is declared. The panel shows it and the worker compiles it. */
  const source = $derived(
    apply(
      text,
      literals.map(({ key, literal }) => ({
        range: literal.range,
        text: write({ ...literal, value: values[key] }),
      })),
    ),
  );

  const points = $derived(handles(values));
  let active = $state<Key | null>(null);
  let src = $state(first.src);
  let error = $state<string | null>(null);

  let compile: ReturnType<typeof createCompiler> | undefined;

  /** The newest source compiled in the worker, then shown once its picture has decoded. */
  const recompile = latestWins(async (next: string) => {
    const result = await (compile ??= createCompiler())(next);
    error = result.ok ? null : result.error.message;

    if (!result.ok) return;
    const img = new Image();
    img.src = svgUrl(result.svg);
    await img.decode();

    if (src !== first.src) URL.revokeObjectURL(src);
    src = img.src;
  });

  const set = (key: Key, v: number) => {
    const value = fit(params[key], v);

    if (value === values[key]) return;
    values = { ...values, [key]: value };
    recompile(source);
  };

  /** A drag carries the value as far as it carries the handle, along the way the handle travels. */
  const drag =
    (key: Key): Attachment<HTMLElement> =>
    (handle) => {
      let raw = 0;
      let last = { x: 0, y: 0 };

      const offs = [
        on(handle, "pointerdown", (e) => {
          // No text selection or native drag starts under the pointer, which would cancel this one.
          e.preventDefault();
          handle.focus();
          handle.setPointerCapture(e.pointerId);
          raw = values[key];
          last = { x: e.clientX, y: e.clientY };
        }),
        on(handle, "pointermove", (e) => {
          if (!handle.hasPointerCapture(e.pointerId)) return;
          const scale = first.width / handle.parentElement!.clientWidth;
          const by = { x: (e.clientX - last.x) * scale, y: (e.clientY - last.y) * scale };
          last = { x: e.clientX, y: e.clientY };
          raw = follow(params[key], (v) => handles({ ...values, [key]: v })[key]!, raw, by);
          set(key, raw);
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

  const nudge = (key: Key) => (e: KeyboardEvent) => {
    const by = ARROWS.get(e.key);

    if (!by) return;
    e.preventDefault();
    set(key, values[key] + by * params[key].step * (e.shiftKey ? 10 : 1));
  };
</script>

<main class="live">
  <figure class="picture">
    <img {src} alt={first.title} width={first.width} height={first.height} />
    {#each keys as key (key)}
      {@const at = points[key]}
      {#if at}
        <div
          class="grip"
          role="slider"
          tabindex="0"
          aria-label={key}
          aria-valuemin={params[key].min}
          aria-valuemax={params[key].max}
          aria-valuenow={values[key]}
          data-value="{key} {values[key]}{params[key].unit ?? ''}"
          style:left="{(at.x / first.width) * 100}%"
          style:top="{(at.y / first.height) * 100}%"
          onkeydown={nudge(key)}
          onfocus={() => (active = key)}
          onblur={() => (active = null)}
          {@attach drag(key)}
        ></div>
      {/if}
    {/each}
  </figure>

  <Code file="pendulum.tsx" {source} {active} />
  <p class="error" role="status" hidden={!error}>{error}</p>
</main>

<style>
  .live {
    display: grid;
    gap: 1.25rem;
    inline-size: min(100% - 2 * var(--gutter), 76rem);
    margin-inline: auto;
    padding-block: 1rem 3rem;
  }
  @media (width >= 60rem) {
    .live {
      grid-template-columns: minmax(0, 3fr) minmax(0, 2fr);
      align-items: start;
    }
    .picture {
      position: sticky;
      inset-block-start: 1rem;
    }
  }

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
  .picture img {
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

  .error {
    grid-column: 1 / -1;
    margin: 0;
    color: var(--warn);
    font: 0.85rem var(--mono);
  }
</style>
