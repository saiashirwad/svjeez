<script lang="ts">
  // A settings card in Svelte 5 with shadcn's look. The switches are its own state; `saved` comes from the parent.
  import "../shadcn.css";

  let { saved = false }: { saved?: boolean } = $props();

  let settings = $state([
    { key: "mentions", title: "Mentions", hint: "When someone @mentions you.", on: true },
    { key: "reviews", title: "Review requests", hint: "When a pull request needs you.", on: false },
    { key: "digest", title: "Weekly digest", hint: "A summary every Monday.", on: false },
  ]);

  let count = $derived(settings.filter((s) => s.on).length);
</script>

<div class="bg-card text-card-foreground flex w-[380px] flex-col gap-5 rounded-xl border py-6 shadow-sm">
  <div class="grid gap-1.5 px-6">
    <div class="flex items-center justify-between">
      <div class="leading-none font-semibold">Notifications</div>
      <span data-part="count" class="bg-secondary text-secondary-foreground rounded-md px-2 py-0.5 text-xs font-medium"
        >{count} on</span
      >
    </div>
    <div class="text-muted-foreground text-sm">Choose what reaches your inbox.</div>
  </div>
  <div class="grid gap-4 px-6">
    {#each settings as setting (setting.key)}
      <div class="flex items-center justify-between gap-4">
        <div class="grid gap-1">
          <div class="text-sm font-medium leading-none">{setting.title}</div>
          <div class="text-muted-foreground text-xs">{setting.hint}</div>
        </div>
        <button
          role="switch"
          aria-checked={setting.on}
          aria-label={setting.title}
          data-part={setting.key}
          onclick={() => (setting.on = !setting.on)}
          class="inline-flex h-[1.15rem] w-8 shrink-0 items-center rounded-full border border-transparent shadow-xs {setting.on
            ? 'bg-primary'
            : 'bg-input'}"
        >
          <span class="bg-background block size-4 rounded-full {setting.on ? 'translate-x-[calc(100%-2px)]' : 'translate-x-0'}"
          ></span>
        </button>
      </div>
    {/each}
  </div>
  <div class="flex items-center justify-between px-6">
    <span class="text-muted-foreground text-xs" data-part="status">{saved ? "Saved just now" : "Unsaved changes"}</span>
    <button
      data-part="save"
      class="bg-primary text-primary-foreground h-9 rounded-md px-4 text-sm font-medium shadow-xs hover:bg-primary/90"
      >{saved ? "Saved" : "Save"}</button
    >
  </div>
</div>
