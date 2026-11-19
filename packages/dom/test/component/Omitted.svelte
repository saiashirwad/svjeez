<script lang="ts">
  let { label, onDone }: { label: string; onDone: () => void } = $props();

  onDone();
</script>

<button id="omitted" onclick={() => onDone()}>{label}</button>
