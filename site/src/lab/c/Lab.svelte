<script lang="ts">
  import { Bench, setBench } from "./bench.svelte";
  import Code from "./Code.svelte";
  import Stage from "./Stage.svelte";
  import Timeline from "./Timeline.svelte";
  import Transport from "./Transport.svelte";

  const bench = new Bench();

  setBench(bench);

  $effect(() => bench.build(bench.source));

  const onkeydown = (event: KeyboardEvent) => {
    if (event.key !== " " || event.target instanceof HTMLButtonElement) return;
    event.preventDefault();
    bench.toggle();
  };
</script>

<svelte:window
  onpointermove={bench.move}
  onpointerup={bench.finish}
  onpointercancel={bench.finish}
  {onkeydown}
/>

<main class="wrap wide lab-c">
  <div
    class="bench"
    data-frozen={bench.frozen === undefined ? undefined : ""}
    data-dragging={bench.drag?.kind}
    {@attach bench.run}
  >
    <section class="work" aria-label="The scene and its timeline">
      <Stage />
      <Transport />
      <Timeline />
      <p class="say" hidden>{bench.hint}</p>
    </section>
    <Code />
  </div>
</main>

<style>
  .lab-c {
    padding-block: 1.5rem 4rem;
  }
  .bench {
    display: flex;
    flex-wrap: wrap;
    gap: var(--gap);
    align-items: start;
  }
  .work {
    flex: 999 1 0;
    min-inline-size: min(100%, 36rem);
    display: grid;
    gap: 0.75rem;
  }
  .say {
    min-block-size: 3em;
    color: var(--muted);
    font-size: 0.88rem;
    max-inline-size: 70ch;
  }
</style>
