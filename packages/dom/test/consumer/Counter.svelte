<script>
  let { label = "Count" } = $props();
  let n = $state(0);
</script>

<button data-part="add" onclick={() => n++} style="font: 16px sans-serif; padding: 8px">{label}: {n}</button>
