<script>
  export let selectableSpecies = []

  export let chooseAll = true
  export let customSpecies = []
  export let includeOthers = false
  export let showIncludeOthers = false

  /**
   * Add the selected species and reset the dropdown.
   * @param {Event} event - Dropdown change event
   */
  function handleSpeciesChange (event) {
    const select = event.currentTarget
    if (select.value && selectableSpecies.includes(select.value)) {
      customSpecies = [...customSpecies, select.value]
    }
    select.value = ''
  }

  /**
   * Removes a species from the custom species
   * @param {string} speciesToRemove - The species to remove
   */
  function removeSpecies (speciesToRemove) {
    customSpecies = customSpecies.filter((species) => species !== speciesToRemove)
  }

  /**
   * Capitalizes the first letter of a string
   * @param {string} string - The string to capitalize
   * @returns {string} - The string with the first letter capitalized
   */
  function capitalizeFirstLetter (string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase()
  }
</script>

<!-- Input for choosing all or custom species -->
<label for='all'>
  <input type='radio' id='all' name='all' bind:group={chooseAll} value={true}> Velg alle
</label>
<label for='custom'>
  <input type='radio' id='custom' name='custom' bind:group={chooseAll} value={false}> Egendefinert
</label>

<!-- Input for handling custom species -->
{#if !chooseAll}
  <div class='inputContainer'>
    <!-- Dropdown with all available species -->
    <div class='dropdownContainer'>
      <label for='speciesDropdown' class='dropdownLabel'>Velg arter:</label>
      <select
        id='speciesDropdown'
        class='speciesDropdown'
        on:change={handleSpeciesChange}
      >
        <option value=''>Velg fra lista...</option>
        {#each [...selectableSpecies].sort() as species}
          {#if !customSpecies.includes(species)}
            <option value={species}>{capitalizeFirstLetter(species)}</option>
          {/if}
        {/each}
      </select>
    </div>

  </div>

  <!-- Custom species choosen by user -->
  {#if customSpecies.length > 0}
    <p class='selectedTitle'>Valgte arter:</p>
    <ul class='selectedSpeciesList'>
      {#each customSpecies as species}
        <li class='speciesItem'>{capitalizeFirstLetter(species)} <button on:click={() => removeSpecies(species)} class='removeButton'>×</button></li>
      {/each}
    </ul>

    <!-- Option to include 'others' category -->
    {#if showIncludeOthers}
      <label class='othersLabel'>
        <input type='checkbox' bind:checked={includeOthers}> Grupper og vis ikke valgte arter sammen
      </label>
    {/if}
  {/if}
{/if}

<style>
  label {
    display: block;
    padding: 0.5em;
    font-size: 1.2rem;
    cursor: pointer;
    border-radius: 0.5em;
  }

  /* Show when a user hovers over the label */
  label:hover {
    background-color: var(--PCOLOR);
    color: white;
  }

  input[type='radio'] {
    /* Make the input radio button larger */
    transform: scale(1.25);
  }

  .inputContainer {
    position: relative;
    width: 100%;
    margin: 1rem 0;
  }

  .dropdownContainer {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 1rem 0.5rem;
  }

  .dropdownLabel {
    font-size: 0.95rem;
    font-weight: 500;
    color: #555;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    cursor: default;
    padding: 0;
    border-radius: 0;
  }

  .dropdownLabel:hover {
    background-color: transparent;
    color: #555;
  }

  .speciesDropdown {
    padding: 0.75rem;
    font-size: 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 6px;
    background-color: white;
    cursor: pointer;
    transition: all 0.2s ease;
    font-family: inherit;
  }

  .speciesDropdown:hover {
    border-color: #b0b0b0;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .speciesDropdown:focus {
    outline: none;
    border-color: #3366ff;
    box-shadow: 0 0 0 3px rgba(51, 102, 255, 0.1);
  }

  .selectedTitle {
    font-size: 0.95rem;
    font-weight: 600;
    color: #333;
    margin: 1rem 0.5rem 0.5rem 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .selectedSpeciesList {
    list-style: none;
    padding: 0;
    margin: 0.5rem 0.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .speciesItem {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    background-color: #e3f2fd;
    border: 1px solid #90caf9;
    padding: 0.5rem 0.75rem;
    border-radius: 20px;
    font-size: 0.95rem;
    color: #1976d2;
  }

  .removeButton {
    background: none;
    border: none;
    color: #1976d2;
    font-size: 1.2rem;
    cursor: pointer;
    padding: 0;
    margin: 0;
    transition: color 0.2s ease;
  }

  .removeButton:hover {
    color: #d32f2f;
  }

  .othersLabel {
    display: block;
    padding: 0.5rem 0.5rem;
    font-size: 0.95rem;
    cursor: pointer;
    margin-top: 0.5rem;
    border-radius: 0.5em;
  }

  .othersLabel:hover {
    background-color: var(--PCOLOR);
    color: white;
  }
</style>
