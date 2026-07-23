<script>
  export let dots = [];
  export let addDot;
  export let removeDot;
  export let undo;
  export let redo;

  $: visibleDots = Array.isArray(dots) ? dots : [];
  $: atMaximum = visibleDots.length >= 20;
  $: atMinimum = visibleDots.length === 0;
</script>

<div class="container">
  <div class="controls">
    <button type="button" on:click={undo}>Undo</button>
    <button type="button" on:click={redo}>Redo</button>
  </div>

  <div class="controls">
    <span class="limit-control" tabindex={atMaximum ? 0 : undefined}>
      <button type="button" on:click={addDot} disabled={atMaximum} aria-describedby={atMaximum ? 'add-limit-tooltip' : undefined}>Add</button>
      {#if atMaximum}
        <span class="limit-tooltip" id="add-limit-tooltip" role="tooltip">Maximum of 20 dots reached.</span>
      {/if}
    </span>
    <span class="limit-control" tabindex={atMinimum ? 0 : undefined}>
      <button type="button" on:click={removeDot} disabled={atMinimum} aria-describedby={atMinimum ? 'remove-limit-tooltip' : undefined}>Remove</button>
      {#if atMinimum}
        <span class="limit-tooltip" id="remove-limit-tooltip" role="tooltip">Minimum of 0 dots reached.</span>
      {/if}
    </span>
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

<style>
  .limit-control {
    display: inline-block;
    position: relative;
  }

  .limit-tooltip {
    background: #1f2933;
    border-radius: 4px;
    bottom: calc(100% + 8px);
    color: #ffffff;
    font: 12px/1.4 Arial, Helvetica, sans-serif;
    left: 50%;
    opacity: 0;
    padding: 6px 8px;
    pointer-events: none;
    position: absolute;
    transform: translateX(-50%);
    visibility: hidden;
    white-space: nowrap;
    z-index: 1;
  }

  .limit-control:hover .limit-tooltip,
  .limit-control:focus .limit-tooltip,
  .limit-control:focus-within .limit-tooltip {
    opacity: 1;
    visibility: visible;
  }
</style>
