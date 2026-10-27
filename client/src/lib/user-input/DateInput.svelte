<script>
  export let selectedStartDate
  export let selectedEndDate

  let isDateFilterActive = false

  // Reset dates when filter is deactivated
  $: if (!isDateFilterActive) {
    selectedStartDate = ''
    selectedEndDate = ''
  }
</script>

<div class='dateContainer'>
  <div class='activateFilterButton'>
    <label for='filterToggle' class='toggleLabel'>
      <input
        id='filterToggle'
        type='checkbox'
        bind:checked={isDateFilterActive}
        class='checkbox'
      />
      <span>Bruk datofilter</span>
    </label>
  </div>

  {#if isDateFilterActive}
    <div class='dateInputsWrapper'>
      <div class='dateInputGroup'>
        <label for='startDate'>Fra</label>
        <input
          id='startDate'
          type='date'
          name='startDate'
          bind:value={selectedStartDate}
          class='dateInput'
        />
      </div>

      <div class='dateInputGroup'>
        <label for='endDate'>Til</label>
        <input
          id='endDate'
          type='date'
          name='endDate'
          bind:value={selectedEndDate}
          class='dateInput'
        />
      </div>
    </div>
  {/if}
</div>

<style>
  .dateContainer {
    padding: 0.5rem;
  }

  .activateFilterButton {
    margin-bottom: 1rem;
  }

  .toggleLabel {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    cursor: pointer;
    font-size: 1rem;
    user-select: none;
    font-weight: 500;
    color: #333;
    transition: color 0.2s ease;
  }

  .toggleLabel:hover {
    color: #0066cc;
  }

  .checkbox {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #3366ff;
  }

  .dateInputsWrapper {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    animation: slideDown 0.3s ease;
  }

  .dateInputGroup {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  label {
    font-size: 0.9rem;
    font-weight: 500;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .dateInput {
    padding: 0.75rem;
    font-size: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .dateInput:hover {
    border-color: #b0b0b0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .dateInput:focus {
    outline: none;
    border-color: #3366ff;
    box-shadow: 0 0 0 3px rgba(51, 102, 255, 0.1);
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
