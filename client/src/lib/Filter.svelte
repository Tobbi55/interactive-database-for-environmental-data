<script>
    import CollapsibleSection from './CollapsibleSection.svelte'
    import RadioInput from './user-input/RadioInput.svelte'
    import DateInput from './user-input/DateInput.svelte'
    import SpeciesInput from './user-input/SpeciesInput.svelte'
    import { DATATYPE_RIVER, DATATYPE_STATION } from '../constants/dataTypes'

    export let selectableSpecies = [] // Species the user can choose

    // User input exported to the page
    export let dataType = DATATYPE_RIVER
    export let selectedStartDate = ''
    export let selectedEndDate = ''
    export let selectedSpecies = []
    export let showSeparateStationColors = false

    let chooseAll = true // If the user wants to choose all species
    let customSpecies = [] // Species the user has chosen

    // Species the user has choosen; either all (which is an empty array) or the custom ones
    $: selectedSpecies = chooseAll ? [] : customSpecies

    // Options when choosing data type
    const dataOptions = [
      { value: DATATYPE_RIVER, label: 'Elvedata' },
      { value: DATATYPE_STATION, label: 'Stasjonsdata' }
    ]

</script>

<div class=main>
    <form>
        <!-- Input for choosing data type -->
        <CollapsibleSection title='Type data'>
            <RadioInput name='dataType' options={dataOptions} bind:selected={dataType} />
            {#if dataType === DATATYPE_STATION}
                <label class='stationColorOption'>
                    <input type='checkbox' bind:checked={showSeparateStationColors} />
                    <span>
                        <span>Vis stasjonsdata med separate farger</span>
                        <small>Stasjoner fra samme elvedata får samme farge.</small>
                    </span>
                </label>
            {/if}
        </CollapsibleSection>

        <!-- Input for choosing date -->
        <CollapsibleSection title='Dato'>
            <DateInput bind:selectedStartDate bind:selectedEndDate/>
        </CollapsibleSection>

        <!-- Input for choosing species -->
        <CollapsibleSection title='Art'>
            <SpeciesInput {selectableSpecies} bind:chooseAll bind:customSpecies />
        </CollapsibleSection>
    </form>
</div>

<style>
    .main {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        overflow: auto;
    }

    .stationColorOption {
        display: flex;
        align-items: flex-start;
        gap: 0.65rem;
        padding: 0.5rem;
        cursor: pointer;
        line-height: 1.3;
    }

    .stationColorOption input {
        margin-top: 0.2rem;
        accent-color: var(--PCOLOR);
    }

    .stationColorOption small {
        display: block;
        margin-top: 0.2rem;
        opacity: 0.75;
    }
</style>
