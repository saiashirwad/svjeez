<script lang="ts">
  interface Props {
    label: string;
    checked: boolean;
    thumb?: string;
    pencil?: boolean;
    onclick: () => void;
  }

  let { label, checked, thumb, pencil = false, onclick }: Props = $props();
</script>

<button
  type="button"
  class={["shape", { drawn: pencil && thumb }]}
  aria-label={label}
  role="radio"
  aria-checked={checked}
  {onclick}
>
  <svg viewBox="-1.2 -1.2 2.4 2.4" aria-hidden="true">
    {#if pencil}
      <path
        class="pencil"
        d="M-0.5 0.55 L-0.42 0.25 L0.3 -0.47 a0.12 0.12 0 0 1 0.17 0 l0.06 0.06 a0.12 0.12 0 0 1 0 0.17 L-0.19 0.48 Z M0.18 -0.35 L0.35 -0.18"
      />
    {/if}
    {#if thumb}
      <path d={thumb} />
    {/if}
  </svg>
</button>

<style>
  .shape {
    aspect-ratio: 1;
    padding: 0.6rem;
    border: 0;
    border-radius: calc(var(--radius) - 0.125rem);
    background: var(--board);
    box-shadow: 0 0 0 1px var(--ring);
    cursor: pointer;
  }

  svg {
    display: block;
    inline-size: 100%;
    block-size: 100%;
    overflow: visible;
  }

  path {
    fill: none;
    stroke: oklch(80% 0.02 300);
    stroke-width: 0.07;
    stroke-linejoin: round;
    stroke-linecap: round;
  }

  .shape[aria-checked="true"] {
    box-shadow: 0 0 0 2px var(--pen);
  }

  .shape[aria-checked="true"] path {
    stroke: var(--pen);
  }

  .shape:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .shape:active {
    scale: 0.94;
  }

  @media (hover: hover) and (pointer: fine) {
    .shape:hover path {
      stroke: oklch(95% 0.02 300);
    }
  }

  @media (prefers-reduced-motion: no-preference) {
    .shape {
      transition: scale 0.12s ease-out;
    }
  }

  .drawn .pencil {
    translate: 0.8px -0.8px;
    scale: 0.4;
  }
</style>
