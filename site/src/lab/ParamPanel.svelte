<script lang="ts" generics="S extends Schema">
  import {
    positionOf,
    valueAt,
    withValues,
    type NumberParam,
    type Param,
    type Schema,
    type Values,
  } from "svjeez/params";
  import { easeText } from "@svjeez/live/source";
  import { easePoints } from "./util";
  import { ease, type Ease } from "svjeez";

  // One control per param a scene declares, drawn from the schema alone. Sliders run on the param's own scale.
  let {
    schema,
    values,
    onchange,
  }: {
    schema: S;
    values: Values<S>;
    onchange: (patch: Partial<Values<S>>) => void;
  } = $props();

  /** Slider positions: fine enough that every step of a log scale up to a few hundred gets a stop. */
  const STOPS = 1000;

  const params = $derived(Object.entries(withValues(schema, values)));

  const set = (key: string, value: Param["value"]) =>
    // SAFETY: `key` and `value` come from the control drawn for `schema[key]`, so the value is that param's kind.
    onchange({ [key]: value } as Partial<Values<S>>);

  const at = (p: NumberParam, v: number) => Math.round(positionOf(p, v) * STOPS);

  const bend = (e: Ease, i: number, v: number) => {
    const next: [number, number, number, number] = [...easePoints(e)];
    next[i] = v;

    return ease.bezier(...next);
  };
</script>

<div class="params">
  {#each params as [key, param] (key)}
    {@const name = param.label ?? key}
    {#if param.kind === "number"}
      {@const { value, unit = "" } = param}
      <label class="number" style:--fill="{(at(param, value) / STOPS) * 100}%">
        <output>{value}{unit}</output>
        <span class="muted">{name}</span>
        <input
          type="range"
          min="0"
          max={STOPS}
          step="1"
          aria-label={name}
          aria-valuetext="{value}{unit}"
          value={at(param, value)}
          oninput={(e) => set(key, valueAt(param, Number(e.currentTarget.value) / STOPS))}
        />
      </label>
    {:else if param.kind === "color"}
      {@const { value } = param}
      <label class="row">
        <span class="muted">{name}</span>
        <input
          type="color"
          value={value.toLowerCase()}
          oninput={(e) => set(key, `#${e.currentTarget.value.slice(1).toUpperCase()}`)}
        />
      </label>
    {:else if param.kind === "choice"}
      <label class="row">
        <span class="muted">{name}</span>
        <select value={param.value} onchange={(e) => set(key, e.currentTarget.value)}>
          {#each param.options as option (option)}
            <option value={option}>{option}</option>
          {/each}
        </select>
      </label>
    {:else}
      {@const { value } = param}
      <fieldset class="row">
        <legend class="muted">{name}</legend>
        <code>{easeText(value)}</code>
        {#each easePoints(value) as v, i (i)}
          <input
            type="number"
            step="0.01"
            aria-label="{name} point {i + 1}"
            value={v}
            onchange={(ev) => set(key, bend(value, i, Number(ev.currentTarget.value)))}
          />
        {/each}
      </fieldset>
    {/if}
  {/each}
</div>

<style>
  .params {
    display: grid;
    gap: 1.25rem;
  }

  .muted {
    color: var(--muted);
  }

  .number {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 0.25rem 0.6rem;
  }

  output {
    font: 600 var(--param-output-size, 1.5rem) / 1 var(--mono);
    font-variant-numeric: tabular-nums;
    letter-spacing: -0.04em;
  }

  .row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    border: 0;
  }

  .row code {
    flex-basis: 100%;
    font: 0.8rem var(--mono);
  }

  .row input[type="number"] {
    inline-size: 4.5rem;
    font: inherit;
  }

  input[type="range"] {
    flex-basis: 100%;
    appearance: none;
    inline-size: 100%;
    block-size: 2.75rem;
    margin: 0;
    background: transparent;
    cursor: grab;
  }

  input[type="range"]:active {
    cursor: grabbing;
  }

  input[type="range"]::-webkit-slider-runnable-track {
    block-size: 0.75rem;
    border-radius: 1rem;
    background:
      linear-gradient(
        to right,
        transparent var(--fill, 50%),
        color-mix(in oklch, var(--bg) 84%, transparent) 0
      ),
      var(--param-track, var(--accent));
    box-shadow: inset 0 0 0 1px var(--ring);
  }

  input[type="range"]::-moz-range-track {
    block-size: 0.75rem;
    border-radius: 1rem;
    background:
      linear-gradient(
        to right,
        transparent var(--fill, 50%),
        color-mix(in oklch, var(--bg) 84%, transparent) 0
      ),
      var(--param-track, var(--accent));
    box-shadow: inset 0 0 0 1px var(--ring);
  }

  input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    inline-size: 1.75rem;
    block-size: 1.75rem;
    margin-block-start: -0.5rem;
    border-radius: 50%;
    background: var(--ink);
    box-shadow:
      0 0 0 4px var(--bg),
      0 2px 10px var(--shadow);
  }

  input[type="range"]::-moz-range-thumb {
    inline-size: 1.75rem;
    block-size: 1.75rem;
    border: 0;
    border-radius: 50%;
    background: var(--ink);
    box-shadow:
      0 0 0 4px var(--bg),
      0 2px 10px var(--shadow);
  }

  input[type="range"]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 4px;
    border-radius: 1rem;
  }
</style>
