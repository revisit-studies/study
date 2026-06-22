<script>
  export let dots = [];
  export let addDot;
  export let removeDot;
  export let undo;
  export let redo;

  $: visibleDots = Array.isArray(dots) ? dots : [];
</script>

<div class="container">
  <div class="controls">
    <button type="button" on:click={undo}>Undo</button>
    <button type="button" on:click={redo}>Redo</button>
  </div>

  <div class="controls">
    <button type="button" on:click={addDot}>Add</button>
    <button type="button" on:click={removeDot}>Remove</button>
  </div>

  <svg viewBox="0 0 500 50" width="500" height="50" aria-label="Dot count">
    {#each visibleDots as dot}
      <circle
        cx={dot * 23}
        cy="25"
        r="10"
        fill="#F4989C"
      />
    {/each}
  </svg>
</div>
