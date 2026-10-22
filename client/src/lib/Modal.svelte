<script>
  import { createEventDispatcher, onMount } from 'svelte'
  import { SVG_PATHS } from '../constants/svgPaths'

  // Dispatcher to close the modal
  const dispatch = createEventDispatcher()

  export let large = false
  export let extraLarge = false
  export let labelledBy = null
  export let ariaLabel = 'Dialog'

  let width
  let height

  /**
   * Closes the modal on click event
   */
  function handleClose () {
    dispatch('close')
  }

  /**
   * Closes the modal when Escape is pressed.
   * @param {KeyboardEvent} event - The keydown event
   */
  function handleKeyDown (event) {
    if (event.key === 'Escape') {
      handleClose()
    }
  }

  onMount(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.body.style.overflow = previousOverflow
    }
  })

  $: width = extraLarge ? 1600 : large ? 800 : 500
  $: height = extraLarge ? 1200 : large ? 500 : 300

</script>

<div class='backdrop' on:click|self={handleClose} on:keydown={handleKeyDown} role='presentation'>
  <div
    class='modal'
    class:extraLarge
    role='dialog'
    aria-modal='true'
    aria-labelledby={labelledBy}
    aria-label={labelledBy ? undefined : ariaLabel}
    style={extraLarge
      ? `width: min(${width}px, calc(100vw - 16px)); height: min(${height}px, calc(100vh - 16px));`
      : `width: ${width}px; min-height: ${height}px;`}
  >
    <slot></slot>
    <button class='close' type='button' aria-label='Lukk dialog' on:click={handleClose}>
      <img src={SVG_PATHS.CLOSE} alt='' />
    </button>
  </div>
</div>

<style>
  .backdrop {
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background-color: rgba(0, 0, 0, 0.5);
    z-index: 9000;
  }

  .modal {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: space-around;
    width: 90%;
    padding: 20px;
    background-color: #fff;
    border-radius: 10px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  }

  .modal.extraLarge {
    box-sizing: border-box;
    min-height: 0;
    max-width: calc(100vw - 16px);
    max-height: calc(100vh - 16px);
    overflow: hidden;
  }

  .close {
    position: absolute;
    top: 10px;
    right: 10px;
    width: 30px;
    height: 30px;
    background: none;
    border: none;
    cursor: pointer;
  }

  .close img {
    width: 100%;
    height: 100%;
  }

  @media (max-width: 600px) {
    .modal {
      max-width: 90%;
      padding: 15px;
    }
  }
</style>
