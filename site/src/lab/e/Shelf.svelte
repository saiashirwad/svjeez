<script lang="ts">
  import { taxon } from "./genome";
  import { getLab, type Specimen } from "./lab.svelte";

  const lab = getLab();

  /** Carry a jar onto the stage to breed with it; click it to bring it back. */
  const grab = (s: Specimen) => (e: PointerEvent) => {
    e.preventDefault();
    lab.carry(
      e,
      { kind: "jar", thumb: s.thumb ?? "" },
      {
        slop: 8,
        over: (m, lifted) => (lab.mating = lifted && lab.viewPoint(m).inside),
        end: (u, lifted) => {
          if (!lifted) return lab.bringBack(s);

          if (lab.viewPoint(u).inside && s.no !== lab.no) lab.breedWith(s);
        },
        clear: () => (lab.mating = false),
      },
    );
  };
</script>

<section class="le-shelf" aria-label="Specimen shelf">
  <ol>
    {#each lab.shelf as s (s.no)}
      <li>
        <button
          type="button"
          class="le-jar"
          aria-label="{taxon(s.genome)}, specimen {s.no}"
          aria-current={s.no === lab.no ? "true" : undefined}
          onpointerdown={grab(s)}
          onclick={(e) => e.detail === 0 && lab.bringBack(s)}
        >
          <img src={s.thumb} alt="" draggable="false" />
          <span>{s.no}</span>
        </button>
      </li>
    {/each}
  </ol>
</section>

<style>
  .le-shelf {
    grid-area: shelf;
    min-inline-size: 0;
  }

  ol {
    display: flex;
    gap: 0.5rem;
    margin: 0;
    padding: 0.1rem 0.1rem 0.4rem;
    list-style: none;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
  }

  li {
    flex: none;
  }

  .le-jar {
    display: grid;
    gap: 0.15rem;
    padding: 0;
    border: 0;
    background: none;
    color: var(--muted);
    font: 0.68rem var(--mono);
    font-variant-numeric: tabular-nums;
    cursor: pointer;
    touch-action: none;
  }

  .le-jar img {
    display: block;
    inline-size: clamp(5rem, 7vw, 6.5rem);
    aspect-ratio: 16 / 10;
    border-radius: 0.4rem;
    background: #f4efe2;
    box-shadow: 0 0 0 1px var(--ring);
  }

  .le-jar[aria-current="true"] {
    color: var(--ink);
    font-weight: 600;
  }

  .le-jar[aria-current="true"] img {
    box-shadow: 0 0 0 2px var(--ink);
  }

  .le-jar:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 2px;
  }

  .le-jar:active {
    scale: 0.96;
  }

  @media (hover: hover) and (pointer: fine) {
    .le-jar:hover img {
      box-shadow: 0 0 0 2px var(--muted);
    }
  }
</style>
