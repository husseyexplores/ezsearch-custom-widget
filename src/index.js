import { domReady } from './utils'
import { hydrateEZSearch } from './ez-search'

window.EZSearchDefaultInstances = []

function initializeEZSearch() {
  let searchRoots = Array.from(
    document.querySelectorAll('[data-ezs="search"]:not([data-ezs-auto-initialize="false"])'),
  )

  searchRoots.forEach(rootNode => {
    document.dispatchEvent(
      new CustomEvent('EZSearch_Loading', {
        detail: rootNode,
      }),
    )

    hydrateEZSearch({
      rootNode,
      autoSearch: false,
      cacheSeconds: 300,
      hasCsvHeaders: false,
      onEvent: (ev, data) => {
        console.log(ev, data, data?.select?.value)
      },
    }).then(instance => {
      window.EZSearchDefaultInstances.push(instance)

      document.dispatchEvent(
        new CustomEvent('EZSearch_Loaded', {
          detail: rootNode,
        }),
      )
    })
  })
}

domReady().then(initializeEZSearch)

export default {
  hydrate: hydrateEZSearch,
}
